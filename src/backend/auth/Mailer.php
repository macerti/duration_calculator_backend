<?php
declare(strict_types=1);

namespace AuditEngine\Auth;

/**
 * Minimal driver-based mailer — no Composer/PHPMailer, matching this
 * codebase's existing "raw PHP, no framework" style (same reasoning as
 * MicrosoftOAuth.php/GoogleOAuth.php using raw cURL instead of a client
 * library). Two drivers:
 *
 *  - 'log'  — writes the email to a local file instead of sending it.
 *             Safe default for local/dev work; this is what this
 *             session's own local config.php used.
 *  - 'smtp' — a hand-rolled SMTP client (AUTH LOGIN, STARTTLS or implicit
 *             TLS) for real sending, e.g. through Mahdi's info@macerti.com
 *             mailbox once its SMTP host/port/username/password are known.
 *             NOT YET LIVE-TESTED against a real mail server — see
 *             docs/DEV_STATUS.md's hand-off note for exactly what's needed
 *             before this can be trusted in production.
 *
 * Config shape expected in config.php's 'mail' key:
 *   'driver'    => 'log' | 'smtp'
 *   'log_path'  => string   (only used by 'log')
 *   'host'      => string   (only used by 'smtp')
 *   'port'      => int      (only used by 'smtp', e.g. 587 or 465)
 *   'encryption'=> 'tls' | 'ssl' | ''  (only used by 'smtp')
 *   'username'  => string   (only used by 'smtp')
 *   'password'  => string   (only used by 'smtp')
 *   'from_email'=> string   (required — e.g. info@macerti.com)
 *   'from_name' => string   (required)
 */

/**
 * @throws \RuntimeException on send failure (caller decides what, if
 *         anything, to tell the end user — never leak SMTP internals to
 *         the client, consistent with this codebase's existing error-
 *         response discipline, see SECURITY.md)
 */
function sendMail(array $config, string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody): void
{
    $mailConfig = $config['mail'] ?? [];
    $driver = $mailConfig['driver'] ?? 'log';

    if ($driver === 'log') {
        sendMailViaLog($mailConfig, $toEmail, $toName, $subject, $htmlBody, $textBody);
        return;
    }

    if ($driver === 'smtp') {
        sendMailViaSmtp($mailConfig, $toEmail, $toName, $subject, $htmlBody, $textBody);
        return;
    }

    throw new \RuntimeException("Pilote d'envoi d'e-mail inconnu : $driver");
}

function sendMailViaLog(array $mailConfig, string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody): void
{
    $path = $mailConfig['log_path'] ?? (sys_get_temp_dir() . '/audit_app_mail_log.txt');
    $entry = "==== " . date('Y-m-d H:i:s') . " ====\n"
        . "To: $toName <$toEmail>\n"
        . "Subject: $subject\n"
        . "--- text ---\n$textBody\n"
        . "--- html ---\n$htmlBody\n\n";
    $written = @file_put_contents($path, $entry, FILE_APPEND | LOCK_EX);
    if ($written === false) {
        throw new \RuntimeException("Impossible d'écrire le journal d'e-mails de test ($path).");
    }
}

function sendMailViaSmtp(array $mailConfig, string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody): void
{
    $host = $mailConfig['host'] ?? '';
    $port = (int)($mailConfig['port'] ?? 587);
    $encryption = $mailConfig['encryption'] ?? 'tls'; // 'tls' (STARTTLS) | 'ssl' (implicit) | ''
    $username = $mailConfig['username'] ?? '';
    $password = $mailConfig['password'] ?? '';
    $fromEmail = $mailConfig['from_email'] ?? '';
    $fromName = $mailConfig['from_name'] ?? '';

    if ($host === '' || $fromEmail === '') {
        throw new \RuntimeException("Configuration SMTP incomplète (host/from_email manquant).");
    }

    $transport = $encryption === 'ssl' ? "ssl://$host" : $host;
    $socket = @stream_socket_client("$transport:$port", $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
    if ($socket === false) {
        throw new \RuntimeException("Connexion SMTP impossible ($host:$port) : $errstr");
    }
    stream_set_timeout($socket, 15);

    $expect = function (string $context) use ($socket): string {
        $line = '';
        do {
            $chunk = fgets($socket, 515);
            if ($chunk === false) break;
            $line .= $chunk;
        } while (isset($chunk[3]) && $chunk[3] === '-'); // multi-line SMTP replies use "250-"
        if ($line === '' || !preg_match('/^[23]\d\d/', $line)) {
            fclose($socket);
            throw new \RuntimeException("Erreur SMTP ($context) : " . trim($line));
        }
        return $line;
    };
    $send = function (string $cmd) use ($socket): void {
        fwrite($socket, $cmd . "\r\n");
    };

    $expect('connect');
    $localHost = $_SERVER['SERVER_NAME'] ?? 'localhost';
    $send("EHLO $localHost");
    $expect('EHLO');

    if ($encryption === 'tls') {
        $send('STARTTLS');
        $expect('STARTTLS');
        if (!@stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($socket);
            throw new \RuntimeException("Échec de la négociation TLS avec le serveur SMTP.");
        }
        $send("EHLO $localHost");
        $expect('EHLO (post-STARTTLS)');
    }

    if ($username !== '') {
        $send('AUTH LOGIN');
        $expect('AUTH LOGIN');
        $send(base64_encode($username));
        $expect('AUTH username');
        $send(base64_encode($password));
        $expect('AUTH password');
    }

    $send("MAIL FROM:<$fromEmail>");
    $expect('MAIL FROM');
    $send("RCPT TO:<$toEmail>");
    $expect('RCPT TO');
    $send('DATA');
    $expect('DATA');

    $boundary = 'ddc-mail-' . bin2hex(random_bytes(8));
    $headers = [
        'From: ' . encodeHeader($fromName) . " <$fromEmail>",
        'To: ' . encodeHeader($toName) . " <$toEmail>",
        'Subject: ' . encodeHeader($subject),
        'MIME-Version: 1.0',
        "Content-Type: multipart/alternative; boundary=\"$boundary\"",
        'Date: ' . date('r'),
    ];
    $body = implode("\r\n", $headers) . "\r\n\r\n"
        . "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
        . dotStuff($textBody) . "\r\n"
        . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
        . dotStuff($htmlBody) . "\r\n"
        . "--$boundary--\r\n";

    $send($body . '.');
    $expect('end of DATA');
    $send('QUIT');
    fclose($socket);
}

/** RFC 5321 transparency: a line starting with "." must be escaped as "..". */
function dotStuff(string $body): string
{
    return preg_replace('/^\./m', '..', $body) ?? $body;
}

function encodeHeader(string $value): string
{
    if (preg_match('/^[\x20-\x7E]*$/', $value)) {
        return $value; // pure ASCII, no encoding needed
    }
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

// =========================================================================
// Auth-specific email templates
// =========================================================================

function sendVerificationEmail(array $config, string $toEmail, string $toName, string $rawToken): void
{
    $appUrl = rtrim($config['app_url'] ?? '', '/');
    $appName = $config['app_name'] ?? 'Audit Duration Calculator';
    $apiBase = rtrim($config['basePath'] ?? '', '/');
    $link = $appUrl . $apiBase . '/api/auth/verify-email?token=' . urlencode($rawToken);

    $subject = "Confirmez votre adresse e-mail — $appName";
    $text = "Bonjour $toName,\n\nConfirmez votre adresse e-mail en cliquant sur ce lien :\n$link\n\n"
        . "Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.\n\n$appName";
    $html = "<p>Bonjour $toName,</p><p>Confirmez votre adresse e-mail en cliquant sur le bouton ci-dessous :</p>"
        . "<p><a href=\"$link\" style=\"display:inline-block;padding:10px 20px;background:#1B4B7A;color:#fff;"
        . "text-decoration:none;border-radius:6px;\">Confirmer mon adresse e-mail</a></p>"
        . "<p>Ou copiez ce lien dans votre navigateur :<br>$link</p>"
        . "<p style=\"color:#666;font-size:13px;\">Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine "
        . "de cette demande, ignorez cet e-mail.</p><p>$appName</p>";

    sendMail($config, $toEmail, $toName, $subject, $html, $text);
}

function sendPasswordResetEmail(array $config, string $toEmail, string $toName, string $rawToken): void
{
    $appUrl = rtrim($config['app_url'] ?? '', '/');
    $appName = $config['app_name'] ?? 'Audit Duration Calculator';
    // Unlike email verification, this link goes straight to the frontend
    // (not a backend redirect) — the user still has to type a new
    // password, so there's a form to show, not a one-shot action. See
    // docs/DEV_STATUS.md's design note on why this differs from the
    // verify-email link shape.
    $link = $appUrl . '/?reset_token=' . urlencode($rawToken);

    $subject = "Réinitialisation de votre mot de passe — $appName";
    $text = "Bonjour $toName,\n\nCliquez sur ce lien pour choisir un nouveau mot de passe :\n$link\n\n"
        . "Ce lien expire dans 1 heure et ne peut être utilisé qu'une seule fois. "
        . "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe actuel reste inchangé.\n\n$appName";
    $html = "<p>Bonjour $toName,</p><p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>"
        . "<p><a href=\"$link\" style=\"display:inline-block;padding:10px 20px;background:#1B4B7A;color:#fff;"
        . "text-decoration:none;border-radius:6px;\">Choisir un nouveau mot de passe</a></p>"
        . "<p>Ou copiez ce lien dans votre navigateur :<br>$link</p>"
        . "<p style=\"color:#666;font-size:13px;\">Ce lien expire dans 1 heure et ne peut être utilisé qu'une seule fois. "
        . "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe actuel reste inchangé.</p>"
        . "<p>$appName</p>";

    sendMail($config, $toEmail, $toName, $subject, $html, $text);
}
