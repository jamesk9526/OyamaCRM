<?php
declare(strict_types=1);

session_name('oyama_form_letters');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')]);
session_start();
header('Content-Type: application/json; charset=utf-8');

function reply(int $status, array $body): never { http_response_code($status); echo json_encode($body); exit; }
function request_body(): array { $value = json_decode(file_get_contents('php://input') ?: '{}', true); return is_array($value) ? $value : []; }
function api_base(): string { return rtrim((string)(getenv('FORM_LETTERS_API_URL') ?: 'http://localhost:4000'), '/'); }
function crm(string $method, string $path, ?array $payload = null, bool $auth = true): array {
  $handle = curl_init(api_base() . $path);
  $headers = ['Accept: application/json'];
  if ($payload !== null) $headers[] = 'Content-Type: application/json';
  if ($auth && !empty($_SESSION['crm_token'])) $headers[] = 'Authorization: Bearer ' . $_SESSION['crm_token'];
  curl_setopt_array($handle, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 5]);
  if ($payload !== null) curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($payload));
  $raw = curl_exec($handle); $error = curl_error($handle); $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE); curl_close($handle);
  if ($raw === false) reply(502, ['error' => ['message' => 'CRM API connection failed: ' . $error]]);
  $decoded = json_decode($raw, true); $body = is_array($decoded) ? $decoded : [];
  if ($status < 200 || $status >= 300) reply($status ?: 502, ['error' => ['message' => $body['error']['message'] ?? $body['error'] ?? 'CRM API request failed.']]);
  return isset($body['data']) && is_array($body['data']) ? $body['data'] : $body;
}

$input = request_body(); $action = (string)($input['action'] ?? '');
if ($action === 'login') {
  $email = trim((string)($input['email'] ?? '')); $password = (string)($input['password'] ?? '');
  if ($email === '' || $password === '') reply(422, ['error' => ['message' => 'Email and password are required.']]);
  $result = crm('POST', '/api/auth/login', ['email' => $email, 'password' => $password], false);
  if (!empty($result['mfaRequired'])) reply(409, ['error' => ['message' => 'Complete MFA in OyamaCRM, then use a session configured for this app.']]);
  if (empty($result['accessToken'])) reply(401, ['error' => ['message' => 'CRM sign-in did not return an access token.']]);
  $_SESSION['crm_token'] = $result['accessToken']; $_SESSION['crm_user'] = $result['user'] ?? [];
  reply(200, ['user' => $_SESSION['crm_user']]);
}
if ($action === 'logout') { $_SESSION = []; session_destroy(); reply(200, ['ok' => true]); }
if (empty($_SESSION['crm_token'])) reply(401, ['error' => ['message' => 'Sign in to OyamaCRM first.']]);
if ($action === 'session') reply(200, ['user' => $_SESSION['crm_user'] ?? []]);
if ($action === 'donors') {
  $params = ['type' => 'DONOR', 'limit' => '200']; $search = trim((string)($input['search'] ?? ''));
  if ($search !== '') $params['search'] = $search;
  reply(200, crm('GET', '/api/constituents?' . http_build_query($params)));
}
if ($action === 'letter_templates') reply(200, crm('GET', '/api/letters/templates?status=ACTIVE'));
if ($action === 'generate_letters') {
  $ids = array_values(array_filter(array_map('strval', (array)($input['constituentIds'] ?? [])))); $template = trim((string)($input['templateId'] ?? ''));
  if (!$ids || $template === '') reply(422, ['error' => ['message' => 'Select donors and an active letter template.']]);
  reply(201, crm('POST', '/api/letters/generated/batch', ['templateId' => $template, 'constituentIds' => $ids, 'deliveryTarget' => 'PDF_ONLY', 'donationMode' => 'none']));
}
if ($action === 'create_email_draft') {
  $emails = array_values(array_unique(array_filter(array_map(fn($item) => strtolower(trim((string)$item)), (array)($input['recipientEmails'] ?? [])), fn($email) => filter_var($email, FILTER_VALIDATE_EMAIL))));
  if (!$emails) reply(422, ['error' => ['message' => 'Selected donors need valid email addresses.']]);
  $html = (string)($input['html'] ?? '');
  reply(201, crm('POST', '/api/email-campaigns', ['name' => trim((string)($input['name'] ?? 'Form letter email draft')) ?: 'Form letter email draft', 'subject' => trim((string)($input['subject'] ?? '')), 'bodyHtml' => $html, 'bodyText' => trim(strip_tags($html)), 'purpose' => 'GENERAL', 'preparationStatus' => 'DRAFT', 'audienceFilter' => ['type' => 'manual-list', 'recipientEmails' => $emails], 'sharedWithOrganization' => false]));
}
reply(404, ['error' => ['message' => 'Unknown action.']]);
