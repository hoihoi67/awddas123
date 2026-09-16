# Bot cennika Discord

Samodzielny bot Discord.js 14 z panelem cennika przeniesionym funkcjonalnie z `Dih bot`.

## Uruchomienie

1. Skopiuj `.env.example` jako `.env` i wpisz token bota, `CLIENT_ID` oraz `GUILD_ID`.
2. Zainstaluj zależności: `npm install`.
3. Zarejestruj komendy na serwerze testowym: `npm run deploy`.
4. Uruchom bota: `npm start`.

Bot musi mieć włączone `Message Content Intent`, ponieważ podczas dodawania i edycji kategorii pobiera treść cennika z wiadomości administratora.

## Panele i komendy

- `!admin-panel` - wysyła panel administratora z przyciskami **Dodaj**, **Edytuj**, **Usuń** i **Podgląd**.
- `!cennik` - wysyła panel z menu kategorii w stylu `Dih bot`, bez obrazka; komendy może użyć każdy.

`!admin-panel` może wysłać tylko administrator, ale przyciski **Dodaj**, **Edytuj**, **Usuń** i **Podgląd** może obsługiwać każdy użytkownik. `!cennik` jest dostępne wyłącznie dla administratorów.

Po kliknięciu **Dodaj** lub **Edytuj** pojawia się formularz. Przy **Usuń** i **Podgląd** najpierw wybiera się kategorię z menu.

Dane są przechowywane lokalnie w `cennik-data.json`. Po zmianie kategorii zapisane panele cennika automatycznie odświeżają menu, więc nie trzeba wysyłać panelu ponownie.
