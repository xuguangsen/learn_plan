@echo off
setlocal

cd /d %~dp0

echo Starting backend (Spring Boot) on http://localhost:8080 ...
mvn -f backend/pom.xml "-Dmaven.repo.local=backend/.m2/repository" spring-boot:run

endlocal
