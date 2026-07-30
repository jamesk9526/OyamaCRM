# Form Letters (PHP)

Standalone PHP 8.2+ letter and email drafting workspace for OyamaCRM. It reads donor data from the existing CRM API and uses the signed-in user's API permissions.

## Run locally

```powershell
$env:FORM_LETTERS_API_URL = "http://localhost:4000"
php -S localhost:8090 -t public public/router.php
```

Open `http://localhost:8090` and sign in with an OyamaCRM account. The access token is held only in the PHP session.

This app runs in parallel to OyamaLetters/OyamaEmail until an explicit cutover is approved.
