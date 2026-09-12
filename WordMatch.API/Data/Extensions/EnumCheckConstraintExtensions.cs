using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace WordMatch.API.Data.Extensions;

internal static class EnumCheckConstraintExtensions
{
    public static CheckConstraintBuilder HasEnumCheckConstraint<TEnum>(
        this TableBuilder tableBuilder,
        string column,
        string? name = null
    )
        where TEnum : struct, Enum
    {
        var values = string.Join(", ", Enum.GetNames<TEnum>().Select(member => $"'{member}'"));

        return tableBuilder.HasCheckConstraint(
            name ?? $"CK_{tableBuilder.Name}_{column}",
            $"\"{column}\" IN ({values})"
        );
    }
}
