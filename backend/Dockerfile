# ============================================================
# Backend Dockerfile — Spring Boot (Portfolio Manager)
# Place this file at the project ROOT (same level as pom.xml)
# ============================================================

# ---- Stage 1: Build ----
# Uses a full Maven+JDK image just to compile — this image itself is
# NOT what gets shipped, so its size doesn't matter.
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy only the POM first so Docker can cache the dependency download layer.
# As long as pom.xml doesn't change, re-builds skip re-downloading every
# dependency from Maven Central — this alone saves minutes per rebuild.
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
RUN mvn dependency:go-offline -B

# Now copy the actual source and build the jar.
# -DskipTests: keep image builds fast; tests should run in CI (see earlier
# GitHub Actions workflow), not block every local docker build.
COPY src ./src
RUN mvn clean package -DskipTests -B

# ---- Stage 2: Run ----
# Small JRE-only image — the final container doesn't need Maven or a full JDK,
# just enough to run the already-compiled jar. Keeps the shipped image lean.
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy only the built jar from the build stage — nothing else crosses over.
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

# Runs as the container's main process. Using the "exec form" (JSON array)
# so Java receives OS signals directly (e.g. graceful shutdown on `docker stop`).
ENTRYPOINT ["java", "-jar", "app.jar"]