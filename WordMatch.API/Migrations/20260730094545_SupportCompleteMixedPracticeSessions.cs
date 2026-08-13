using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class SupportCompleteMixedPracticeSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_PracticeSessionWords",
                table: "PracticeSessionWords"
            );

            migrationBuilder.DropIndex(
                name: "IX_PracticeSessionWords_PracticeSessionId_Position",
                table: "PracticeSessionWords"
            );

            migrationBuilder.AddPrimaryKey(
                name: "PK_PracticeSessionWords",
                table: "PracticeSessionWords",
                columns: new[] { "PracticeSessionId", "Position" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_PracticeSessionWords_PracticeSessionId_WordId_Direction",
                table: "PracticeSessionWords",
                columns: new[] { "PracticeSessionId", "WordId", "Direction" },
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_PracticeSessionWords",
                table: "PracticeSessionWords"
            );

            migrationBuilder.DropIndex(
                name: "IX_PracticeSessionWords_PracticeSessionId_WordId_Direction",
                table: "PracticeSessionWords"
            );

            migrationBuilder.Sql(
                """
                DELETE FROM "PracticeSessionWords" AS duplicate
                USING "PracticeSessionWords" AS retained
                WHERE duplicate."PracticeSessionId" = retained."PracticeSessionId"
                  AND duplicate."WordId" = retained."WordId"
                  AND duplicate."Position" > retained."Position";
                """
            );

            migrationBuilder.AddPrimaryKey(
                name: "PK_PracticeSessionWords",
                table: "PracticeSessionWords",
                columns: new[] { "PracticeSessionId", "WordId" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_PracticeSessionWords_PracticeSessionId_Position",
                table: "PracticeSessionWords",
                columns: new[] { "PracticeSessionId", "Position" },
                unique: true
            );
        }
    }
}
