using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class AddBidirectionalPracticeModes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(name: "PK_UserWordProgress", table: "UserWordProgress");

            migrationBuilder.AddColumn<string>(
                name: "Direction",
                table: "UserWordProgress",
                type: "text",
                nullable: false,
                defaultValue: "EnglishToTurkish"
            );

            migrationBuilder.AddColumn<string>(
                name: "Direction",
                table: "PracticeSessionWords",
                type: "text",
                nullable: false,
                defaultValue: "EnglishToTurkish"
            );

            migrationBuilder.AddColumn<string>(
                name: "PromptSnapshot",
                table: "PracticeSessionWords",
                type: "text",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "Mode",
                table: "PracticeSessions",
                type: "text",
                nullable: false,
                defaultValue: "EnglishToTurkish"
            );

            migrationBuilder.Sql(
                """
                UPDATE "PracticeSessionWords"
                SET "PromptSnapshot" = "EnglishSnapshot";

                UPDATE "PracticeSessions"
                SET "CategoryKey" = "CategoryKey" || '|Mode|EnglishToTurkish'
                WHERE "CategoryKey" NOT LIKE '%|Mode|%';
                """
            );

            migrationBuilder.AlterColumn<string>(
                name: "PromptSnapshot",
                table: "PracticeSessionWords",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true
            );

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserWordProgress",
                table: "UserWordProgress",
                columns: new[] { "UserId", "WordId", "Direction" }
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserWordProgress_Direction",
                table: "UserWordProgress",
                sql: "\"Direction\" IN ('EnglishToTurkish', 'TurkishToEnglish')"
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_PracticeSessionWords_Direction",
                table: "PracticeSessionWords",
                sql: "\"Direction\" IN ('EnglishToTurkish', 'TurkishToEnglish')"
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_PracticeSessionWords_Prompt",
                table: "PracticeSessionWords",
                sql: "length(trim(\"PromptSnapshot\")) > 0"
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_PracticeSessions_Mode",
                table: "PracticeSessions",
                sql: "\"Mode\" IN ('EnglishToTurkish', 'TurkishToEnglish', 'Mixed')"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(name: "PK_UserWordProgress", table: "UserWordProgress");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserWordProgress_Direction",
                table: "UserWordProgress"
            );

            migrationBuilder.DropCheckConstraint(
                name: "CK_PracticeSessionWords_Direction",
                table: "PracticeSessionWords"
            );

            migrationBuilder.DropCheckConstraint(
                name: "CK_PracticeSessionWords_Prompt",
                table: "PracticeSessionWords"
            );

            migrationBuilder.DropCheckConstraint(
                name: "CK_PracticeSessions_Mode",
                table: "PracticeSessions"
            );

            migrationBuilder.Sql(
                """
                UPDATE "PracticeSessions"
                SET "CategoryKey" = regexp_replace(
                    "CategoryKey",
                    '\|Mode\|EnglishToTurkish$',
                    ''
                );
                """
            );

            migrationBuilder.DropColumn(name: "Direction", table: "UserWordProgress");

            migrationBuilder.DropColumn(name: "Direction", table: "PracticeSessionWords");

            migrationBuilder.DropColumn(name: "PromptSnapshot", table: "PracticeSessionWords");

            migrationBuilder.DropColumn(name: "Mode", table: "PracticeSessions");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserWordProgress",
                table: "UserWordProgress",
                columns: new[] { "UserId", "WordId" }
            );
        }
    }
}
