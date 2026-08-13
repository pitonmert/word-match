using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class RemoveAutomaticQuestionPreference : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutomaticallyLoadNextQuestion",
                table: "AspNetUsers"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutomaticallyLoadNextQuestion",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: true
            );
        }
    }
}
