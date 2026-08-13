using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class EnforceSingleActiveCategorySession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PracticeSessions_UserId_CategoryKey",
                table: "PracticeSessions"
            );

            migrationBuilder.Sql(
                """
                WITH ranked_sessions AS (
                    SELECT
                        "Id",
                        ROW_NUMBER() OVER (
                            PARTITION BY "UserId", "Level", "Topic"
                            ORDER BY "LastActivityAtUtc" DESC, "StartedAtUtc" DESC, "Id"
                        ) AS row_number
                    FROM "PracticeSessions"
                    WHERE "Status" = 'Active'
                )
                UPDATE "PracticeSessions" AS session
                SET "Status" = 'Abandoned'
                FROM ranked_sessions AS ranked
                WHERE session."Id" = ranked."Id"
                    AND ranked.row_number > 1;
                """
            );

            migrationBuilder.CreateIndex(
                name: "IX_PracticeSessions_UserId_Level_Topic",
                table: "PracticeSessions",
                columns: new[] { "UserId", "Level", "Topic" },
                unique: true,
                filter: "\"Status\" = 'Active'"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PracticeSessions_UserId_Level_Topic",
                table: "PracticeSessions"
            );

            migrationBuilder.CreateIndex(
                name: "IX_PracticeSessions_UserId_CategoryKey",
                table: "PracticeSessions",
                columns: new[] { "UserId", "CategoryKey" },
                unique: true,
                filter: "\"Status\" = 'Active'"
            );
        }
    }
}
