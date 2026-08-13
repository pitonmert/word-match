FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY WordMatch.API.csproj ./
RUN dotnet restore WordMatch.API.csproj

COPY . ./
RUN dotnet publish WordMatch.API.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 8080

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/wordmatch/data-protection \
    && chown -R app:app /var/lib/wordmatch

COPY --from=build /app/publish .
USER app
ENTRYPOINT ["dotnet", "WordMatch.API.dll"]
