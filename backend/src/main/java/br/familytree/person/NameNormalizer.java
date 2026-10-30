package br.familytree.person;

import java.text.Normalizer;
import java.util.Locale;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/** Minusculas, sem acento, espacos colapsados. Usado em search_name e nas consultas. */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class NameNormalizer {

    public static String normalize(String s) {
        if (s == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(s, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }
}
