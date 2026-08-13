using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDefaultPracticeModePreference : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DefaultPracticeMode",
                table: "AspNetUsers",
                type: "text",
                nullable: true
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_AspNetUsers_DefaultPracticeMode",
                table: "AspNetUsers",
                sql: "\"DefaultPracticeMode\" IS NULL OR \"DefaultPracticeMode\" IN ('EnglishToTurkish', 'TurkishToEnglish', 'Mixed')"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_AspNetUsers_DefaultPracticeMode",
                table: "AspNetUsers"
            );

            migrationBuilder.DropColumn(name: "DefaultPracticeMode", table: "AspNetUsers");
        }
    }
}
