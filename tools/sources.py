"""書目。只放標準書目與公開連結。"""
SOURCES = {
    "HAC": ("A. J. Menezes, P. C. van Oorschot, S. A. Vanstone",
            "Handbook of Applied Cryptography", "CRC Press, 1997",
            "https://cacr.uwaterloo.ca/hac/"),
    "HMV": ("D. Hankerson, A. Menezes, S. Vanstone",
            "Guide to Elliptic Curve Cryptography", "Springer, 2004", ""),
    "Washington": ("L. C. Washington",
                   "Elliptic Curves: Number Theory and Cryptography", "2nd ed., CRC Press, 2008", ""),
    "HPS": ("J. Hoffstein, J. Pipher, J. H. Silverman",
            "An Introduction to Mathematical Cryptography", "2nd ed., Springer, 2014", ""),
    "PP": ("C. Paar, J. Pelzl", "Understanding Cryptography", "Springer, 2010", ""),
    "HECC": ("H. Cohen, G. Frey (eds.)",
             "Handbook of Elliptic and Hyperelliptic Curve Cryptography", "CRC Press, 2006", ""),
    "SP800-186": ("NIST", "SP 800-186: Recommendations for Discrete Logarithm-based Cryptography: Elliptic Curve Domain Parameters",
                  "2023", "https://doi.org/10.6028/NIST.SP.800-186"),
    "SP800-57": ("NIST", "SP 800-57 Part 1 Rev. 5: Recommendation for Key Management",
                 "2020", "https://doi.org/10.6028/NIST.SP.800-57pt1r5"),
    "RFC7748": ("A. Langley, M. Hamburg, S. Turner", "RFC 7748: Elliptic Curves for Security",
                "IETF, 2016", "https://www.rfc-editor.org/rfc/rfc7748"),
    "SEC2": ("Certicom Research", "SEC 2: Recommended Elliptic Curve Domain Parameters",
             "v2.0, 2010", "https://www.secg.org/sec2-v2.pdf"),
    "EFD": ("D. J. Bernstein, T. Lange", "Explicit-Formulas Database", "",
            "https://hyperelliptic.org/EFD/"),
    "Montgomery85": ("P. L. Montgomery", "Modular multiplication without trial division",
                     "Mathematics of Computation 44 (1985), 519–521",
                     "https://doi.org/10.1090/S0025-5718-1985-0777282-X"),
    "Barrett86": ("P. Barrett", "Implementing the Rivest Shamir and Adleman public key encryption algorithm on a standard digital signal processor",
                  "CRYPTO '86, LNCS 263, 311–323", "https://doi.org/10.1007/3-540-47721-7_24"),
    "Solinas99": ("J. A. Solinas", "Generalized Mersenne numbers",
                  "Technical Report CORR 99-39, University of Waterloo, 1999", ""),
}


def cite_html(key, where=""):
    a, t, pub, url = SOURCES[key]
    title = f'<a href="{url}" target="_blank" rel="noopener"><cite>{t}</cite></a>' if url else f"<cite>{t}</cite>"
    w = f' <span class="where">— {where}</span>' if where else ""
    return f"{a}, {title}, {pub}.{w}" if pub else f"{a}, {title}.{w}"
