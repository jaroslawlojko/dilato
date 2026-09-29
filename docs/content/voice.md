# Voice & tone — content source

- **Source:** `stylebook/project/Foundations.dc.html`, section "Głos marki".
- **Style:** "Poranny horyzont" (morning horizon): warm dawn light, clean air, the calm depth of the night sky. No smoke, no ash, no hospital white.

## Voice: like a friend who quit themselves

| Trait | PL | EN |
|---|---|---|
| Warm | Mówimy „Ty”, krótko, po ludzku. Bez moralizowania. | Second person, short, human. No moralising. |
| Concrete | Liczby i fakty o ciele zamiast haseł motywacyjnych. | Numbers and body facts instead of motivational slogans. |
| Calm | Bez wykrzykników w nadmiarze, bez presji czasu. | No excess exclamation marks, no time pressure. |
| Gender-neutral | „Udało się”, „Twój wynik” — albo formy wybrane w ustawieniach. | English is naturally neutral; PL uses `grammar_form`. |

## We say

| PL | EN |
|---|---|
| „Masz już 9 h bez dymu. Twoja krew niesie więcej tlenu.” | "You're already 9 h smoke-free. Your blood is carrying more oxygen." |
| „41 minut to 41 minut, które zyskało Twoje ciało.” | "41 minutes is 41 minutes your body gained." |
| „Fala głodu trwa zwykle kilka minut. Przeczekajmy ją razem.” | "A craving wave usually lasts a few minutes. Let's ride it out together." |

## We don't say

- „Palenie zabija. Każdy papieros skraca życie o 11 minut.”
- „Porażka! Seria przerwana. Zacznij od nowa.”
- „Nie bądź słaby, dasz radę!!!”

## Polish grammar forms (`grammar_form`)

- **`neutral` (default):** prefer impersonal/neutral constructions: „Udało się”, „Twój wynik”, „Zapisano”.
- **Where neutrality is impossible:**
  - `neutral` uses the slash form: „sam(a)”, „zapaliłem(-am)”.
  - `f` / `m` use the chosen form.
- **i18n:** keys needing a form use the i18next context: `key_f`, `key_m`, `key_neutral`.

## Failure language

- Interruption is always **"Tym razem się nie udało"** / **"Didn't work out this time"**.
- It is never "failure", "porażka" or "streak broken".
- It is always visually quiet, in Zmierzch/Lawenda, never red.
