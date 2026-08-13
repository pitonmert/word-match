using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class InvalidateLegacyMixedPracticeSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE "PracticeSessions" AS session
                SET "Status" = 'Abandoned',
                    "CompletedAtUtc" = NULL
                WHERE session."Mode" = 'Mixed'
                  AND session."Status" IN ('Active', 'Completed')
                  AND (
                      SELECT COUNT(*)
                      FROM "PracticeSessionWords" AS session_word
                      WHERE session_word."PracticeSessionId" = session."Id"
                  ) <> 2 * (
                      SELECT COUNT(DISTINCT session_word."WordId")
                      FROM "PracticeSessionWords" AS session_word
                      WHERE session_word."PracticeSessionId" = session."Id"
                  );
                """
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) { }
    }
}
