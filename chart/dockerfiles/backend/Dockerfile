FROM eclipse-temurin:17-jre-alpine

WORKDIR hangar

ENV TERM xterm-256color

EXPOSE 8080
# "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005" is for debug only
ENTRYPOINT ["java", "-jar", "app.jar"]

ADD backend/target/hangar-*.jar /hangar/app.jar
