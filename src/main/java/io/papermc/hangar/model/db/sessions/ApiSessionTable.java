package io.papermc.hangar.model.db.sessions;

import io.papermc.hangar.model.db.Table;

import java.time.OffsetDateTime;

public class ApiSessionTable extends Table {

    private final String token;
    private final Long keyId;
    private final Long userId;
    private final OffsetDateTime expires;

    public ApiSessionTable(OffsetDateTime createdAt, long id, String token, Long keyId, Long userId, OffsetDateTime expires) {
        super(createdAt, id);
        this.token = token;
        this.keyId = keyId;
        this.userId = userId;
        this.expires = expires;
    }

    private ApiSessionTable(String token, Long keyId, Long userId, OffsetDateTime expires) {
        this.token = token;
        this.keyId = keyId;
        this.userId = userId;
        this.expires = expires;
    }

    public String getToken() {
        return token;
    }

    public Long getKeyId() {
        return keyId;
    }

    public Long getUserId() {
        return userId;
    }

    public OffsetDateTime getExpires() {
        return expires;
    }

    public static ApiSessionTable fromApiKey(String token, ApiKeyTable apiKeyTable, OffsetDateTime expires) {
        return new ApiSessionTable(token, apiKeyTable.getId(), apiKeyTable.getOwnerId(), expires);
    }

    public static ApiSessionTable createPublicKey(String token, OffsetDateTime expires) {
        return new ApiSessionTable(token, null, null, expires);
    }

    public static ApiSessionTable createUserKey(String token, long userId, OffsetDateTime expires) {
        return new ApiSessionTable(token, null, userId, expires);
    }
}
