using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AspNetRoles",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(
                        type: "character varying(256)",
                        maxLength: 256,
                        nullable: true
                    ),
                    NormalizedName = table.Column<string>(
                        type: "character varying(256)",
                        maxLength: 256,
                        nullable: true
                    ),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoles", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "AspNetUsers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                    UserName = table.Column<string>(
                        type: "character varying(256)",
                        maxLength: 256,
                        nullable: true
                    ),
                    NormalizedUserName = table.Column<string>(
                        type: "character varying(256)",
                        maxLength: 256,
                        nullable: true
                    ),
                    Email = table.Column<string>(
                        type: "character varying(256)",
                        maxLength: 256,
                        nullable: true
                    ),
                    NormalizedEmail = table.Column<string>(
                        type: "character varying(256)",
                        maxLength: 256,
                        nullable: true
                    ),
                    EmailConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: true),
                    SecurityStamp = table.Column<string>(type: "text", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true),
                    PhoneNumber = table.Column<string>(type: "text", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: true
                    ),
                    LockoutEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "integer", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUsers", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "CurriculumTopics",
                columns: table => new
                {
                    Id = table
                        .Column<int>(type: "integer", nullable: false)
                        .Annotation(
                            "Npgsql:ValueGenerationStrategy",
                            NpgsqlValueGenerationStrategy.IdentityByDefaultColumn
                        ),
                    Level = table.Column<string>(type: "text", nullable: false),
                    Topic = table.Column<string>(type: "text", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CurriculumTopics", x => x.Id);
                    table.CheckConstraint(
                        "CK_CurriculumTopics_Level",
                        "\"Level\" IN ('A1', 'A2', 'B1', 'B2')"
                    );
                    table.CheckConstraint("CK_CurriculumTopics_SortOrder", "\"SortOrder\" > 0");
                    table.CheckConstraint(
                        "CK_CurriculumTopics_Status",
                        "\"Status\" IN ('Active', 'Retired')"
                    );
                    table.CheckConstraint(
                        "CK_CurriculumTopics_Topic",
                        "\"Topic\" IN ('Actions', 'Animals', 'ArtsAndEntertainment', 'BodyAndHealth', 'CalendarAndTime', 'Clothing', 'Colors', 'Countries', 'Days', 'Descriptions', 'Education', 'EmotionsAndPersonality', 'FamilyAndPeople', 'FoodAndDrink', 'General', 'HomeAndObjects', 'JobsAndWork', 'Months', 'NatureAndWeather', 'Numbers', 'Places', 'ShoppingAndMoney', 'SocietyAndPolitics', 'SportsAndLeisure', 'TechnologyAndMedia', 'Transportation', 'TravelAndHolidays')"
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "Words",
                columns: table => new
                {
                    Id = table
                        .Column<int>(type: "integer", nullable: false)
                        .Annotation(
                            "Npgsql:ValueGenerationStrategy",
                            NpgsqlValueGenerationStrategy.IdentityByDefaultColumn
                        ),
                    ImportKey = table.Column<string>(
                        type: "character varying(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    TurkishTranslations = table.Column<string[]>(type: "text[]", nullable: false),
                    English = table.Column<string>(type: "text", nullable: false),
                    PartOfSpeech = table.Column<string>(type: "text", nullable: false),
                    PastSimple = table.Column<string>(type: "text", nullable: true),
                    PastParticiple = table.Column<string>(type: "text", nullable: true),
                    IsIrregular = table.Column<bool>(type: "boolean", nullable: false),
                    Level = table.Column<string>(type: "text", nullable: false),
                    Topic = table.Column<string>(type: "text", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Words", x => x.Id);
                    table.CheckConstraint("CK_Words_ImportKey", "length(trim(\"ImportKey\")) > 0");
                    table.CheckConstraint(
                        "CK_Words_Level",
                        "\"Level\" IN ('A1', 'A2', 'B1', 'B2')"
                    );
                    table.CheckConstraint(
                        "CK_Words_PartOfSpeech",
                        "\"PartOfSpeech\" IN ('Verb', 'Noun', 'Adjective', 'ProperNoun', 'Number', 'Pronoun')"
                    );
                    table.CheckConstraint(
                        "CK_Words_Topic",
                        "\"Topic\" IN ('Actions', 'Animals', 'ArtsAndEntertainment', 'BodyAndHealth', 'CalendarAndTime', 'Clothing', 'Colors', 'Countries', 'Days', 'Descriptions', 'Education', 'EmotionsAndPersonality', 'FamilyAndPeople', 'FoodAndDrink', 'General', 'HomeAndObjects', 'JobsAndWork', 'Months', 'NatureAndWeather', 'Numbers', 'Places', 'ShoppingAndMoney', 'SocietyAndPolitics', 'SportsAndLeisure', 'TechnologyAndMedia', 'Transportation', 'TravelAndHolidays')"
                    );
                    table.CheckConstraint(
                        "CK_Words_TurkishTranslations",
                        "cardinality(\"TurkishTranslations\") > 0 AND array_position(\"TurkishTranslations\", NULL) IS NULL AND array_position(\"TurkishTranslations\", '') IS NULL"
                    );
                    table.CheckConstraint(
                        "CK_Words_VerbMetadata",
                        "(\"PartOfSpeech\" = 'Verb' AND \"PastSimple\" IS NOT NULL AND \"PastParticiple\" IS NOT NULL) OR (\"PartOfSpeech\" <> 'Verb' AND \"PastSimple\" IS NULL AND \"PastParticiple\" IS NULL AND NOT \"IsIrregular\")"
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "AspNetRoleClaims",
                columns: table => new
                {
                    Id = table
                        .Column<int>(type: "integer", nullable: false)
                        .Annotation(
                            "Npgsql:ValueGenerationStrategy",
                            NpgsqlValueGenerationStrategy.IdentityByDefaultColumn
                        ),
                    RoleId = table.Column<string>(type: "text", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoleClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetRoleClaims_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "AspNetUserClaims",
                columns: table => new
                {
                    Id = table
                        .Column<int>(type: "integer", nullable: false)
                        .Annotation(
                            "Npgsql:ValueGenerationStrategy",
                            NpgsqlValueGenerationStrategy.IdentityByDefaultColumn
                        ),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "AspNetUserLogins",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    ProviderKey = table.Column<string>(type: "text", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<string>(type: "text", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey(
                        "PK_AspNetUserLogins",
                        x => new { x.LoginProvider, x.ProviderKey }
                    );
                    table.ForeignKey(
                        name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "AspNetUserRoles",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    RoleId = table.Column<string>(type: "text", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "AspNetUserTokens",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey(
                        "PK_AspNetUserTokens",
                        x => new
                        {
                            x.UserId,
                            x.LoginProvider,
                            x.Name,
                        }
                    );
                    table.ForeignKey(
                        name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "UserStudySkillPauses",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Dimension = table.Column<string>(type: "text", nullable: false),
                    DeferredUntilUtc = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserStudySkillPauses", x => new { x.UserId, x.Dimension });
                    table.CheckConstraint(
                        "CK_UserStudySkillPauses_Dimension",
                        "\"Dimension\" IN ('WrittenRecognition', 'WrittenRecall', 'AuralRecognition', 'SpokenRecall')"
                    );
                    table.ForeignKey(
                        name: "FK_UserStudySkillPauses_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "StudySessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    OwnerDeviceId = table.Column<string>(
                        type: "character varying(32)",
                        maxLength: 32,
                        nullable: true
                    ),
                    Mode = table.Column<string>(type: "text", nullable: false),
                    CurriculumTopicId = table.Column<int>(type: "integer", nullable: true),
                    ReturnToCurriculumTopicId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    StartedAtUtc = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                    LastActivityAtUtc = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                    CompletedAtUtc = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: true
                    ),
                    ContinuationReservedAtUtc = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: true
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudySessions", x => x.Id);
                    table.CheckConstraint(
                        "CK_StudySessions_Mode",
                        "\"Mode\" IN ('Topic', 'Review')"
                    );
                    table.CheckConstraint(
                        "CK_StudySessions_ModeSelection",
                        "(\"Mode\" = 'Topic' AND \"CurriculumTopicId\" IS NOT NULL) OR (\"Mode\" = 'Review' AND \"CurriculumTopicId\" IS NULL)"
                    );
                    table.CheckConstraint(
                        "CK_StudySessions_Status",
                        "\"Status\" IN ('Active', 'Completed', 'Abandoned')"
                    );
                    table.ForeignKey(
                        name: "FK_StudySessions_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_StudySessions_CurriculumTopics_CurriculumTopicId",
                        column: x => x.CurriculumTopicId,
                        principalTable: "CurriculumTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict
                    );
                    table.ForeignKey(
                        name: "FK_StudySessions_CurriculumTopics_ReturnToCurriculumTopicId",
                        column: x => x.ReturnToCurriculumTopicId,
                        principalTable: "CurriculumTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "CurriculumTopicWords",
                columns: table => new
                {
                    CurriculumTopicId = table.Column<int>(type: "integer", nullable: false),
                    WordId = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    LearningGroupSortOrder = table.Column<int>(
                        type: "integer",
                        nullable: false,
                        defaultValue: 1
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey(
                        "PK_CurriculumTopicWords",
                        x => new { x.CurriculumTopicId, x.WordId }
                    );
                    table.CheckConstraint(
                        "CK_CurriculumTopicWords_LearningGroupSortOrder",
                        "\"LearningGroupSortOrder\" > 0"
                    );
                    table.CheckConstraint("CK_CurriculumTopicWords_SortOrder", "\"SortOrder\" > 0");
                    table.ForeignKey(
                        name: "FK_CurriculumTopicWords_CurriculumTopics_CurriculumTopicId",
                        column: x => x.CurriculumTopicId,
                        principalTable: "CurriculumTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_CurriculumTopicWords_Words_WordId",
                        column: x => x.WordId,
                        principalTable: "Words",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "UserWordIntroductions",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    WordId = table.Column<int>(type: "integer", nullable: false),
                    IntroducedAtUtc = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserWordIntroductions", x => new { x.UserId, x.WordId });
                    table.ForeignKey(
                        name: "FK_UserWordIntroductions_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_UserWordIntroductions_Words_WordId",
                        column: x => x.WordId,
                        principalTable: "Words",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "UserWordMastery",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    WordId = table.Column<int>(type: "integer", nullable: false),
                    Dimension = table.Column<string>(type: "text", nullable: false),
                    Stage = table.Column<int>(type: "integer", nullable: false),
                    ConsecutiveCorrectCount = table.Column<int>(type: "integer", nullable: false),
                    CorrectCount = table.Column<int>(type: "integer", nullable: false),
                    ReviewCount = table.Column<int>(type: "integer", nullable: false),
                    WrongCount = table.Column<int>(type: "integer", nullable: false),
                    LastOutcome = table.Column<string>(type: "text", nullable: false),
                    LastStudiedAtUtc = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                    NextReviewAtUtc = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey(
                        "PK_UserWordMastery",
                        x => new
                        {
                            x.UserId,
                            x.WordId,
                            x.Dimension,
                        }
                    );
                    table.CheckConstraint(
                        "CK_UserWordMastery_Counts",
                        "\"CorrectCount\" >= 0 AND \"ReviewCount\" >= 0 AND \"WrongCount\" >= 0 AND \"ConsecutiveCorrectCount\" >= 0"
                    );
                    table.CheckConstraint(
                        "CK_UserWordMastery_Dimension",
                        "\"Dimension\" IN ('WrittenRecognition', 'WrittenRecall', 'AuralRecognition', 'SpokenRecall')"
                    );
                    table.CheckConstraint(
                        "CK_UserWordMastery_Outcome",
                        "\"LastOutcome\" IN ('Correct', 'Review', 'Wrong')"
                    );
                    table.CheckConstraint(
                        "CK_UserWordMastery_Stage",
                        "\"Stage\" >= 0 AND \"Stage\" <= 5"
                    );
                    table.ForeignKey(
                        name: "FK_UserWordMastery_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_UserWordMastery_Words_WordId",
                        column: x => x.WordId,
                        principalTable: "Words",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "StudySessionQuestions",
                columns: table => new
                {
                    StudySessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    WordId = table.Column<int>(type: "integer", nullable: false),
                    Dimension = table.Column<string>(type: "text", nullable: false),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    EnglishSnapshot = table.Column<string>(type: "text", nullable: false),
                    PromptSnapshot = table.Column<string>(type: "text", nullable: false),
                    CorrectAnswerSnapshot = table.Column<string>(type: "text", nullable: false),
                    Options = table.Column<string[]>(type: "text[]", nullable: true),
                    CorrectIndex = table.Column<int>(type: "integer", nullable: true),
                    AcceptedAnswersSnapshot = table.Column<string[]>(
                        type: "text[]",
                        nullable: true
                    ),
                    IsIntroduction = table.Column<bool>(type: "boolean", nullable: false),
                    SelectedIndex = table.Column<int>(type: "integer", nullable: true),
                    SelectedText = table.Column<string>(type: "text", nullable: true),
                    Outcome = table.Column<string>(type: "text", nullable: true),
                    AnsweredAtUtc = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: true
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey(
                        "PK_StudySessionQuestions",
                        x => new { x.StudySessionId, x.Position }
                    );
                    table.CheckConstraint(
                        "CK_StudySessionQuestions_Answer",
                        "(\"Outcome\" IS NULL AND \"SelectedIndex\" IS NULL AND \"SelectedText\" IS NULL AND \"AnsweredAtUtc\" IS NULL) OR (\"Outcome\" = 'Review' AND \"SelectedIndex\" IS NULL AND \"SelectedText\" IS NULL AND \"AnsweredAtUtc\" IS NOT NULL) OR (\"Kind\" = 'MultipleChoice' AND \"Outcome\" IN ('Correct', 'Wrong') AND \"SelectedIndex\" IS NOT NULL AND \"SelectedText\" IS NULL AND \"AnsweredAtUtc\" IS NOT NULL) OR (\"Kind\" = 'Written' AND \"Outcome\" IN ('Correct', 'Wrong') AND \"SelectedIndex\" IS NULL AND \"SelectedText\" IS NOT NULL AND length(trim(\"SelectedText\")) > 0 AND \"AnsweredAtUtc\" IS NOT NULL)"
                    );
                    table.CheckConstraint(
                        "CK_StudySessionQuestions_Dimension",
                        "\"Dimension\" IN ('WrittenRecognition', 'WrittenRecall', 'AuralRecognition', 'SpokenRecall')"
                    );
                    table.CheckConstraint(
                        "CK_StudySessionQuestions_Kind",
                        "\"Kind\" IN ('MultipleChoice', 'Written')"
                    );
                    table.CheckConstraint("CK_StudySessionQuestions_Position", "\"Position\" >= 0");
                    table.CheckConstraint(
                        "CK_StudySessionQuestions_QuestionData",
                        "(\"Kind\" = 'MultipleChoice' AND \"Options\" IS NOT NULL AND cardinality(\"Options\") = 4 AND \"CorrectIndex\" IS NOT NULL AND \"CorrectIndex\" >= 0 AND \"CorrectIndex\" < 4 AND \"AcceptedAnswersSnapshot\" IS NULL) OR (\"Kind\" = 'Written' AND \"Options\" IS NULL AND \"CorrectIndex\" IS NULL AND \"AcceptedAnswersSnapshot\" IS NOT NULL AND cardinality(\"AcceptedAnswersSnapshot\") > 0)"
                    );
                    table.ForeignKey(
                        name: "FK_StudySessionQuestions_StudySessions_StudySessionId",
                        column: x => x.StudySessionId,
                        principalTable: "StudySessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_StudySessionQuestions_Words_WordId",
                        column: x => x.WordId,
                        principalTable: "Words",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_AspNetRoleClaims_RoleId",
                table: "AspNetRoleClaims",
                column: "RoleId"
            );

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "AspNetRoles",
                column: "NormalizedName",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserClaims_UserId",
                table: "AspNetUserClaims",
                column: "UserId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserLogins_UserId",
                table: "AspNetUserLogins",
                column: "UserId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserRoles_RoleId",
                table: "AspNetUserRoles",
                column: "RoleId"
            );

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "AspNetUsers",
                column: "NormalizedUserName",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_CurriculumTopics_Level_SortOrder",
                table: "CurriculumTopics",
                columns: new[] { "Level", "SortOrder" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_CurriculumTopics_Level_Topic",
                table: "CurriculumTopics",
                columns: new[] { "Level", "Topic" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_CurriculumTopicWords_CurriculumTopicId_LearningGroupSortOrd~",
                table: "CurriculumTopicWords",
                columns: new[] { "CurriculumTopicId", "LearningGroupSortOrder" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_CurriculumTopicWords_CurriculumTopicId_SortOrder",
                table: "CurriculumTopicWords",
                columns: new[] { "CurriculumTopicId", "SortOrder" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_CurriculumTopicWords_WordId",
                table: "CurriculumTopicWords",
                column: "WordId",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_StudySessionQuestions_StudySessionId_WordId_Dimension",
                table: "StudySessionQuestions",
                columns: new[] { "StudySessionId", "WordId", "Dimension" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_StudySessionQuestions_WordId",
                table: "StudySessionQuestions",
                column: "WordId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_StudySessions_CurriculumTopicId",
                table: "StudySessions",
                column: "CurriculumTopicId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_StudySessions_ReturnToCurriculumTopicId",
                table: "StudySessions",
                column: "ReturnToCurriculumTopicId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_StudySessions_UserId",
                table: "StudySessions",
                column: "UserId",
                unique: true,
                filter: "\"Status\" = 'Active'"
            );

            migrationBuilder.CreateIndex(
                name: "IX_StudySessions_UserId_ContinuationReservedAtUtc",
                table: "StudySessions",
                columns: new[] { "UserId", "ContinuationReservedAtUtc" },
                filter: "\"ContinuationReservedAtUtc\" IS NOT NULL"
            );

            migrationBuilder.CreateIndex(
                name: "IX_UserStudySkillPauses_DeferredUntilUtc",
                table: "UserStudySkillPauses",
                column: "DeferredUntilUtc"
            );

            migrationBuilder.CreateIndex(
                name: "IX_UserWordIntroductions_UserId_IntroducedAtUtc",
                table: "UserWordIntroductions",
                columns: new[] { "UserId", "IntroducedAtUtc" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_UserWordIntroductions_WordId",
                table: "UserWordIntroductions",
                column: "WordId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_UserWordMastery_UserId_NextReviewAtUtc",
                table: "UserWordMastery",
                columns: new[] { "UserId", "NextReviewAtUtc" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_UserWordMastery_WordId",
                table: "UserWordMastery",
                column: "WordId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_Words_English_PartOfSpeech",
                table: "Words",
                columns: new[] { "English", "PartOfSpeech" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_Words_ImportKey",
                table: "Words",
                column: "ImportKey",
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "AspNetRoleClaims");

            migrationBuilder.DropTable(name: "AspNetUserClaims");

            migrationBuilder.DropTable(name: "AspNetUserLogins");

            migrationBuilder.DropTable(name: "AspNetUserRoles");

            migrationBuilder.DropTable(name: "AspNetUserTokens");

            migrationBuilder.DropTable(name: "CurriculumTopicWords");

            migrationBuilder.DropTable(name: "StudySessionQuestions");

            migrationBuilder.DropTable(name: "UserStudySkillPauses");

            migrationBuilder.DropTable(name: "UserWordIntroductions");

            migrationBuilder.DropTable(name: "UserWordMastery");

            migrationBuilder.DropTable(name: "AspNetRoles");

            migrationBuilder.DropTable(name: "StudySessions");

            migrationBuilder.DropTable(name: "Words");

            migrationBuilder.DropTable(name: "AspNetUsers");

            migrationBuilder.DropTable(name: "CurriculumTopics");
        }
    }
}
