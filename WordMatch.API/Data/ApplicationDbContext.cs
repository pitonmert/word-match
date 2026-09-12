using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using WordMatch.API.Features.Auth;
using WordMatch.API.Features.Study;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Word> Words => Set<Word>();

    public DbSet<CurriculumTopic> CurriculumTopics => Set<CurriculumTopic>();
    public DbSet<CurriculumTopicWord> CurriculumTopicWords => Set<CurriculumTopicWord>();

    public DbSet<UserWordIntroduction> UserWordIntroductions => Set<UserWordIntroduction>();
    public DbSet<UserWordMastery> UserWordMastery => Set<UserWordMastery>();
    public DbSet<UserStudySkillPause> UserStudySkillPauses => Set<UserStudySkillPause>();

    public DbSet<StudySession> StudySessions => Set<StudySession>();
    public DbSet<StudySessionQuestion> StudySessionQuestions => Set<StudySessionQuestion>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
