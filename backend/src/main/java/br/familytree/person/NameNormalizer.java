package br.familytree.person;

import java.text.Normalizer;
import java.util.Locale;

/** Minusculas, sem acento, espacos colapsados. Usado em search_name e nas consultas. */
public final class NameNormalizer {

    private NameNormalizer() {}

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
