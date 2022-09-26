import { useAuthStore } from "~/store/auth";
import { useCookies } from "~/composables/useCookies";
import { useInternalApi } from "~/composables/useApi";
import { useAxios } from "~/composables/useAxios";
import { authLog } from "~/lib/composables/useLog";
import { HangarUser } from "hangar-internal";
import * as domain from "~/composables/useDomain";
import { Pinia } from "pinia";
import { AxiosError, AxiosRequestHeaders } from "axios";
import { useResponse } from "~/composables/useResReq";
import Cookies from "universal-cookie";
import jwtDecode, { JwtPayload } from "jwt-decode";
import { useConfig } from "~/lib/composables/useConfig";

class Auth {
  loginUrl(redirectUrl: string): string {
    if (redirectUrl.endsWith("?loggedOut")) {
      redirectUrl = redirectUrl.replace("?loggedOut", "");
    }
    return `/login?returnUrl=${useConfig().publicHost}${redirectUrl}`;
  }

  async logout() {
    location.replace(`/logout?returnUrl=${useConfig().publicHost}?loggedOut`);
  }

  validateToken(token: string) {
    if (!token) {
      return false;
    }
    const decoded = jwtDecode<JwtPayload>(token);
    if (!decoded.exp) {
      return false;
    }
    return decoded.exp * 1000 > Date.now() - 10 * 1000; // check against 10 seconds earlier to mitigate tokens expiring mid-request
  }

  // TODO do we need to scope this to the user?
  refreshPromise: Promise<boolean | string> | null = null;

  async refreshToken() {
    authLog("refresh token");
    if (this.refreshPromise) {
      authLog("locked, lets wait");
      const result = await this.refreshPromise;
      authLog("lock over", result);
      return result;
    }

    // eslint-disable-next-line no-async-promise-executor
    this.refreshPromise = new Promise<boolean | string>(async (resolve) => {
      const refreshToken = useCookies().get("HangarAuth_REFRESH");
      if (import.meta.env.SSR && !refreshToken) {
        authLog("no cookie, no point in refreshing");
        resolve(false);
        this.refreshPromise = null;
        return;
      }

      try {
        authLog("do request");
        const headers: AxiosRequestHeaders = {};
        if (import.meta.env.SSR) {
          headers.cookie = "HangarAuth_REFRESH=" + refreshToken;
          authLog("pass refresh cookie", refreshToken);
        }
        const response = await useAxios.get("/refresh", { headers });
        if (response.status === 299) {
          authLog("had no cookie");
          resolve(false);
        } else if (import.meta.env.SSR) {
          if (response.headers["set-cookie"]) {
            useResponse()?.setHeader("set-cookie", response.headers["set-cookie"]);
            const token = new Cookies(response.headers["set-cookie"]?.join("; ")).get("HangarAuth");
            if (token) {
              authLog("got token");
              resolve(token);
            } else {
              authLog("got no token in cookie header", response.headers["set-cookie"]);
              resolve(false);
            }
          } else {
            authLog("got no cookie header back");
            resolve(false);
          }
        } else {
          authLog("done");
          resolve(true);
        }
        this.refreshPromise = null;
      } catch (e) {
        this.refreshPromise = null;
        if ((e as AxiosError).response?.data) {
          const { trace, ...err } = (e as AxiosError).response?.data as { trace: any };
          authLog("Refresh failed", err);
        } else {
          authLog("Refresh failed");
        }
        resolve(false);
      }
    });
    return this.refreshPromise;
  }

  async invalidate() {
    const store = useAuthStore(this.usePiniaIfPresent());
    store.$patch({
      user: null,
      authenticated: false,
    });
    if (!store.invalidated) {
      await useAxios.get("/invalidate").catch((e) => authLog("Invalidate failed", e.message));
    }
    if (!import.meta.env.SSR) {
      useCookies().remove("HangarAuth_REFRESH", { path: "/" });
      useCookies().remove("HangarAuth", { path: "/" });
      authLog("Invalidated auth cookies");
    }
    store.invalidated = true;
  }

  async updateUser(): Promise<void> {
    const authStore = useAuthStore(this.usePiniaIfPresent());
    if (authStore.invalidated) {
      authLog("no point in updating if we just invalidated");
      return;
    }
    const user = await useInternalApi<HangarUser>("users/@me", true).catch(async (err) => {
      authLog("no user");
      return this.invalidate();
    });
    if (user) {
      authLog("patching " + user.name);
      authStore.setUser(user);
      authStore.$patch({ authenticated: true, invalidated: false });
      authLog("user is now " + authStore.user?.name);
    }
  }

  usePiniaIfPresent() {
    return import.meta.env.SSR ? domain.get<Pinia>("pinia") : null;
  }
}

export const useAuth = new Auth();
