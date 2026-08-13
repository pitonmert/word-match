using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class RemovePartOfSpeechPracticeFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM "PracticeSessions"
                WHERE "CategoryType" = 'PartOfSpeech';
                """
            );

            migrationBuilder.DropCheckConstraint(
                name: "CK_PracticeSessions_Category",
                table: "PracticeSessions"
            );

            migrationBuilder.DropColumn(name: "CategoryType", table: "PracticeSessions");

            migrationBuilder.DropColumn(name: "PartOfSpeech", table: "PracticeSessions");

            migrationBuilder.Sql(
                """
                ALTER TABLE "PracticeSessions"
                ALTER COLUMN "Topic" SET NOT NULL;
                """
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Topic",
                table: "PracticeSessions",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text"
            );

            migrationBuilder.AddColumn<string>(
                name: "CategoryType",
                table: "PracticeSessions",
                type: "text",
                nullable: false,
                defaultValue: "Topic"
            );

            migrationBuilder.AddColumn<string>(
                name: "PartOfSpeech",
                table: "PracticeSessions",
                type: "text",
                nullable: true
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_PracticeSessions_Category",
                table: "PracticeSessions",
                sql: "(\"CategoryType\" = 'Topic' AND \"Topic\" IS NOT NULL AND \"PartOfSpeech\" IS NULL) OR (\"CategoryType\" = 'PartOfSpeech' AND \"Topic\" IS NULL AND \"PartOfSpeech\" IS NOT NULL)"
            );
        }
    }
}
