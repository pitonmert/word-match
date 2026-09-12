using System.Text;

namespace WordMatch.API.Bootstrap;

public static class WordBootstrapCsv
{
    public static IReadOnlyList<string[]> ParseRows(string csv)
    {
        var rows = new List<string[]>();
        var row = new List<string>();
        var field = new StringBuilder();
        var inQuotedField = false;

        for (var index = 0; index < csv.Length; index++)
        {
            var character = csv[index];
            if (character == '"')
            {
                if (inQuotedField && index + 1 < csv.Length && csv[index + 1] == '"')
                {
                    field.Append(character);
                    index++;
                }
                else
                {
                    inQuotedField = !inQuotedField;
                }

                continue;
            }

            if (character == ',' && !inQuotedField)
            {
                row.Add(field.ToString());
                field.Clear();
                continue;
            }

            if (character == '\n' && !inQuotedField)
            {
                row.Add(field.ToString().TrimEnd('\r'));
                rows.Add([.. row]);
                row.Clear();
                field.Clear();
                continue;
            }

            field.Append(character);
        }

        if (inQuotedField)
            throw new WordBootstrapValidationException(
                "CSV içinde kapanmamış bir tırnak alanı var."
            );

        if (field.Length > 0 || row.Count > 0)
        {
            row.Add(field.ToString());
            rows.Add([.. row]);
        }

        return rows;
    }

    public static string[] ParsePostgresTextArray(string value)
    {
        if (value.Length < 2 || value[0] != '{' || value[^1] != '}')
            throw new WordBootstrapValidationException(
                "TurkishTranslations geçerli bir PostgreSQL text[] değeri değil."
            );

        var rows = ParseRows(value[1..^1]);
        if (rows.Count != 1)
            throw new WordBootstrapValidationException(
                "TurkishTranslations tek bir CSV satırı olmalıdır."
            );

        return rows[0];
    }
}
