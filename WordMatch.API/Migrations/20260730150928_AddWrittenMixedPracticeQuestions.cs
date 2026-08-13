using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class AddWrittenMixedPracticeQuestions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(name: "PK_UserWordProgress", table: "UserWordProgress");

            migrationBuilder.DropIndex(
                name: "IX_PracticeSessionWords_PracticeSessionId_WordId_Direction",
                table: "PracticeSessionWords"
            );

            migrationBuilder.DropCheckConstraint(
                name: "CK_PracticeSessionWords_Answer",
                table: "PracticeSessionWords"
            );

            migrationBuilder.AddColumn<string>(
                name: "Format",
                table: "UserWordProgress",
                type: "text",
                nullable: false,
                defaultValue: "MultipleChoice"
            );

            migrationBuilder.AddColumn<string[]>(
                name: "AcceptedAnswersSnapshot",
                table: "PracticeSessionWords",
                type: "text[]",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "Format",
                table: "PracticeSessionWords",
                type: "text",
                nullable: false,
                defaultValue: "MultipleChoice"
            );

            migrationBuilder.AddColumn<string>(
                name: "SelectedText",
                table: "PracticeSessionWords",
                type: "text",
                nullable: true
            );

            migrationBuilder.Sql(
                """
                UPDATE "PracticeSessions"
                SET "Status" = 'Abandoned',
                    "CompletedAtUtc" = NULL
                WHERE "Mode" = 'Mixed'
                  AND "Status" IN ('Active', 'Completed');
                """
            );

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserWordProgress",
                table: "UserWordProgress",
                columns: new[] { "UserId", "WordId", "Direction", "Format" }
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserWordProgress_Format",
                table: "UserWordProgress",
                sql: "\"Format\" IN ('MultipleChoice', 'Written')"
            );

            migrationBuilder.CreateIndex(
                name: "IX_PracticeSessionWords_PracticeSessionId_WordId_Direction_For~",
                table: "PracticeSessionWords",
                columns: new[] { "PracticeSessionId", "WordId", "Direction", "Format" },
                unique: true
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_PracticeSessionWords_Answer",
                table: "PracticeSessionWords",
                sql: "(\"Outcome\" IS NULL AND \"SelectedIndex\" IS NULL AND \"SelectedText\" IS NULL AND \"AnsweredAtUtc\" IS NULL) OR (\"Outcome\" = 'Review' AND \"SelectedIndex\" IS NULL AND \"SelectedText\" IS NULL AND \"AnsweredAtUtc\" IS NOT NULL) OR (\"Format\" = 'MultipleChoice' AND \"Outcome\" IN ('Correct', 'Wrong') AND \"SelectedIndex\" IS NOT NULL AND \"SelectedText\" IS NULL AND \"AnsweredAtUtc\" IS NOT NULL) OR (\"Format\" = 'Written' AND \"Outcome\" IN ('Correct', 'Wrong') AND \"SelectedIndex\" IS NULL AND \"SelectedText\" IS NOT NULL AND length(trim(\"SelectedText\")) > 0 AND \"AnsweredAtUtc\" IS NOT NULL)"
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_PracticeSessionWords_Format",
                table: "PracticeSessionWords",
                sql: "\"Format\" IN ('MultipleChoice', 'Written')"
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_PracticeSessionWords_QuestionData",
                table: "PracticeSessionWords",
                sql: "(\"Format\" = 'MultipleChoice' AND \"AcceptedAnswersSnapshot\" IS NULL AND ((\"Options\" IS NULL AND \"CorrectIndex\" IS NULL) OR (\"Options\" IS NOT NULL AND \"CorrectIndex\" IS NOT NULL AND cardinality(\"Options\") = 4 AND \"CorrectIndex\" >= 0 AND \"CorrectIndex\" < cardinality(\"Options\")))) OR (\"Format\" = 'Written' AND \"Options\" IS NULL AND \"CorrectIndex\" IS NULL AND \"AcceptedAnswersSnapshot\" IS NOT NULL AND cardinality(\"AcceptedAnswersSnapshot\") > 0)"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(name: "PK_UserWordProgress", table: "UserWordProgress");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserWordProgress_Format",
                table: "UserWordProgress"
            );

            migrationBuilder.DropIndex(
                name: "IX_PracticeSessionWords_PracticeSessionId_WordId_Direction_For~",
                table: "PracticeSessionWords"
            );

            migrationBuilder.DropCheckConstraint(
                name: "CK_PracticeSessionWords_Answer",
                table: "PracticeSessionWords"
            );

            migrationBuilder.DropCheckConstraint(
                name: "CK_PracticeSessionWords_Format",
                table: "PracticeSessionWords"
            );

            migrationBuilder.DropCheckConstraint(
                name: "CK_PracticeSessionWords_QuestionData",
                table: "PracticeSessionWords"
            );

            migrationBuilder.Sql(
                """
                DELETE FROM "UserWordProgress"
                WHERE "Format" = 'Written';

                DELETE FROM "PracticeSessionWords"
                WHERE "Format" = 'Written';
                """
            );

            migrationBuilder.DropColumn(name: "Format", table: "UserWordProgress");

            migrationBuilder.DropColumn(
                name: "AcceptedAnswersSnapshot",
                table: "PracticeSessionWords"
            );

            migrationBuilder.DropColumn(name: "Format", table: "PracticeSessionWords");

            migrationBuilder.DropColumn(name: "SelectedText", table: "PracticeSessionWords");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserWordProgress",
                table: "UserWordProgress",
                columns: new[] { "UserId", "WordId", "Direction" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_PracticeSessionWords_PracticeSessionId_WordId_Direction",
                table: "PracticeSessionWords",
                columns: new[] { "PracticeSessionId", "WordId", "Direction" },
                unique: true
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_PracticeSessionWords_Answer",
                table: "PracticeSessionWords",
                sql: "(\"Outcome\" IS NULL AND \"SelectedIndex\" IS NULL AND \"AnsweredAtUtc\" IS NULL) OR (\"Outcome\" IS NOT NULL AND \"AnsweredAtUtc\" IS NOT NULL)"
            );
        }
    }
}
