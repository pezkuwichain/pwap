-- =====================================================
-- Migration 015: Expanded Payment Methods (50+ methods)
-- OKX-Style: 900+ payment methods equivalent regional coverage
-- =====================================================

-- Ensure payment_methods table exists with all fields
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency VARCHAR(10) NOT NULL,
  country VARCHAR(100) NOT NULL,
  method_name VARCHAR(100) NOT NULL,
  method_type VARCHAR(50) NOT NULL CHECK (method_type IN ('bank', 'mobile_payment', 'cash', 'crypto_exchange', 'e_wallet', 'card', 'remittance')),
  logo_url TEXT,
  fields JSONB DEFAULT '{}',
  validation_rules JSONB DEFAULT '{}',
  min_trade_amount DECIMAL(18,2) DEFAULT 0,
  max_trade_amount DECIMAL(18,2),
  processing_time_minutes INT DEFAULT 30,
  display_order INT DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  requires_verification BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_methods_currency ON payment_methods(currency);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active);

-- =====================================================
-- TURKEY (TRY) - 15 Payment Methods
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
-- Major Banks
('TRY', 'Turkey', 'Ziraat Bankası', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}',
  '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}',
  100, 15, 1),
('TRY', 'Turkey', 'İş Bankası', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}',
  '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}',
  100, 15, 2),
('TRY', 'Turkey', 'Garanti BBVA', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}',
  '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}',
  100, 15, 3),
('TRY', 'Turkey', 'Akbank', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}',
  '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}',
  100, 15, 4),
('TRY', 'Turkey', 'Yapı Kredi', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}',
  '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}',
  100, 15, 5),
('TRY', 'Turkey', 'Halkbank', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}',
  '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}',
  100, 15, 6),
('TRY', 'Turkey', 'Vakıfbank', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}',
  '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}',
  100, 15, 7),
('TRY', 'Turkey', 'QNB Finansbank', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}',
  '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}',
  100, 15, 8),
('TRY', 'Turkey', 'Denizbank', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}',
  '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}',
  100, 15, 9),
('TRY', 'Turkey', 'TEB', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}',
  '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}',
  100, 15, 10),
-- E-Wallets & Mobile
('TRY', 'Turkey', 'Papara', 'e_wallet',
  '{"papara_number": "Papara Number", "account_holder": "Account Holder Name"}',
  '{"papara_number": {"pattern": "^[0-9]{10}$", "required": true}}',
  50, 5, 11),
('TRY', 'Turkey', 'Ininal', 'e_wallet',
  '{"ininal_number": "Ininal Card Number"}',
  '{"ininal_number": {"required": true}}',
  50, 5, 12),
('TRY', 'Turkey', 'ENPARA', 'mobile_payment',
  '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}',
  '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}',
  100, 10, 13),
('TRY', 'Turkey', 'Tosla', 'e_wallet',
  '{"tosla_number": "Tosla Number"}',
  '{"tosla_number": {"required": true}}',
  50, 5, 14),
('TRY', 'Turkey', 'PTT', 'remittance',
  '{"account_holder": "Recipient Name", "tc_number": "TC Kimlik No"}',
  '{"tc_number": {"pattern": "^[0-9]{11}$", "required": true}}',
  100, 30, 15)
ON CONFLICT DO NOTHING;

-- =====================================================
-- IRAQ (IQD) - 10 Payment Methods
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('IQD', 'Iraq', 'Rasheed Bank', 'bank',
  '{"account_holder": "Account Holder Name", "account_number": "Account Number"}',
  '{"account_number": {"required": true}}',
  100000, 30, 1),
('IQD', 'Iraq', 'Rafidain Bank', 'bank',
  '{"account_holder": "Account Holder Name", "account_number": "Account Number"}',
  '{"account_number": {"required": true}}',
  100000, 30, 2),
('IQD', 'Iraq', 'Trade Bank of Iraq', 'bank',
  '{"account_holder": "Account Holder Name", "account_number": "Account Number"}',
  '{"account_number": {"required": true}}',
  100000, 30, 3),
('IQD', 'Iraq', 'Kurdistan International Bank', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}',
  '{"iban": {"required": true}}',
  50000, 20, 4),
('IQD', 'Iraq', 'Cihan Bank', 'bank',
  '{"account_holder": "Account Holder Name", "account_number": "Account Number"}',
  '{"account_number": {"required": true}}',
  50000, 20, 5),
('IQD', 'Iraq', 'ZainCash', 'mobile_payment',
  '{"phone_number": "ZainCash Phone Number"}',
  '{"phone_number": {"pattern": "^\\+964[0-9]{10}$", "required": true}}',
  10000, 5, 6),
('IQD', 'Iraq', 'AsiaHawala', 'mobile_payment',
  '{"phone_number": "AsiaHawala Phone Number"}',
  '{"phone_number": {"pattern": "^\\+964[0-9]{10}$", "required": true}}',
  10000, 5, 7),
('IQD', 'Iraq', 'FastPay', 'mobile_payment',
  '{"phone_number": "FastPay Phone Number", "fastpay_id": "FastPay ID"}',
  '{"fastpay_id": {"required": true}}',
  10000, 5, 8),
('IQD', 'Iraq', 'Qi Card', 'e_wallet',
  '{"card_number": "Qi Card Number"}',
  '{"card_number": {"required": true}}',
  25000, 10, 9),
('IQD', 'Iraq', 'Cash in Person', 'cash',
  '{"city": "City", "meeting_point": "Meeting Point Details"}',
  '{"city": {"required": true}}',
  50000, 60, 10)
ON CONFLICT DO NOTHING;

-- =====================================================
-- IRAN (IRR) - 10 Payment Methods
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('IRR', 'Iran', 'Bank Melli Iran', 'bank',
  '{"account_holder": "Account Holder Name", "sheba": "Sheba Number", "card_number": "Card Number"}',
  '{"sheba": {"pattern": "^IR[0-9]{24}$", "required": true}}',
  5000000, 30, 1),
('IRR', 'Iran', 'Bank Mellat', 'bank',
  '{"account_holder": "Account Holder Name", "sheba": "Sheba Number", "card_number": "Card Number"}',
  '{"sheba": {"pattern": "^IR[0-9]{24}$", "required": true}}',
  5000000, 30, 2),
('IRR', 'Iran', 'Bank Saderat', 'bank',
  '{"account_holder": "Account Holder Name", "sheba": "Sheba Number"}',
  '{"sheba": {"pattern": "^IR[0-9]{24}$", "required": true}}',
  5000000, 30, 3),
('IRR', 'Iran', 'Bank Tejarat', 'bank',
  '{"account_holder": "Account Holder Name", "sheba": "Sheba Number"}',
  '{"sheba": {"pattern": "^IR[0-9]{24}$", "required": true}}',
  5000000, 30, 4),
('IRR', 'Iran', 'Parsian Bank', 'bank',
  '{"account_holder": "Account Holder Name", "sheba": "Sheba Number"}',
  '{"sheba": {"pattern": "^IR[0-9]{24}$", "required": true}}',
  5000000, 30, 5),
('IRR', 'Iran', 'Bank Pasargad', 'bank',
  '{"account_holder": "Account Holder Name", "sheba": "Sheba Number"}',
  '{"sheba": {"pattern": "^IR[0-9]{24}$", "required": true}}',
  5000000, 30, 6),
('IRR', 'Iran', 'Saman Bank', 'bank',
  '{"account_holder": "Account Holder Name", "sheba": "Sheba Number"}',
  '{"sheba": {"pattern": "^IR[0-9]{24}$", "required": true}}',
  5000000, 30, 7),
('IRR', 'Iran', 'Card to Card', 'card',
  '{"card_number": "16-digit Card Number", "account_holder": "Card Holder Name"}',
  '{"card_number": {"pattern": "^[0-9]{16}$", "required": true}}',
  1000000, 5, 8),
('IRR', 'Iran', 'Shaparak', 'mobile_payment',
  '{"card_number": "Card Number", "mobile": "Mobile Number"}',
  '{"card_number": {"required": true}}',
  1000000, 5, 9),
('IRR', 'Iran', 'Cash in Person', 'cash',
  '{"city": "City", "meeting_point": "Meeting Point Details"}',
  '{"city": {"required": true}}',
  10000000, 60, 10)
ON CONFLICT DO NOTHING;

-- =====================================================
-- EURO (EUR) - 10 Payment Methods
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('EUR', 'Europe', 'SEPA Bank Transfer', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN", "bic": "BIC/SWIFT"}',
  '{"iban": {"pattern": "^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$", "required": true}}',
  10, 60, 1),
('EUR', 'Europe', 'SEPA Instant', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN"}',
  '{"iban": {"pattern": "^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$", "required": true}}',
  10, 5, 2),
('EUR', 'Europe', 'N26', 'mobile_payment',
  '{"account_holder": "Account Holder Name", "iban": "IBAN"}',
  '{"iban": {"required": true}}',
  10, 5, 3),
('EUR', 'Europe', 'Revolut', 'e_wallet',
  '{"revolut_tag": "Revolut Tag (@username)", "phone": "Phone Number"}',
  '{"revolut_tag": {"pattern": "^@[a-z0-9]+$", "required": true}}',
  5, 5, 4),
('EUR', 'Europe', 'Wise (TransferWise)', 'e_wallet',
  '{"email": "Wise Email", "account_holder": "Account Holder Name"}',
  '{"email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}',
  5, 10, 5),
('EUR', 'Europe', 'PayPal', 'e_wallet',
  '{"paypal_email": "PayPal Email"}',
  '{"paypal_email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}',
  10, 5, 6),
('EUR', 'Germany', 'Deutsche Bank', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN", "bic": "BIC"}',
  '{"iban": {"pattern": "^DE[0-9]{20}$", "required": true}}',
  10, 30, 7),
('EUR', 'France', 'BNP Paribas', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN", "bic": "BIC"}',
  '{"iban": {"pattern": "^FR[0-9]{25}$", "required": true}}',
  10, 30, 8),
('EUR', 'Netherlands', 'ING', 'bank',
  '{"account_holder": "Account Holder Name", "iban": "IBAN"}',
  '{"iban": {"pattern": "^NL[0-9]{2}[A-Z]{4}[0-9]{10}$", "required": true}}',
  10, 30, 9),
('EUR', 'Europe', 'Skrill', 'e_wallet',
  '{"skrill_email": "Skrill Email"}',
  '{"skrill_email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}',
  10, 10, 10)
ON CONFLICT DO NOTHING;

-- =====================================================
-- US DOLLAR (USD) - 10 Payment Methods
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('USD', 'United States', 'Zelle', 'mobile_payment',
  '{"email_or_phone": "Email or Phone linked to Zelle"}',
  '{"email_or_phone": {"required": true}}',
  10, 5, 1),
('USD', 'United States', 'Venmo', 'mobile_payment',
  '{"venmo_username": "Venmo Username (@)"}',
  '{"venmo_username": {"pattern": "^@[a-zA-Z0-9_-]+$", "required": true}}',
  10, 5, 2),
('USD', 'United States', 'CashApp', 'mobile_payment',
  '{"cashtag": "Cash Tag ($)"}',
  '{"cashtag": {"pattern": "^\\$[a-zA-Z0-9_]+$", "required": true}}',
  10, 5, 3),
('USD', 'United States', 'PayPal', 'e_wallet',
  '{"paypal_email": "PayPal Email"}',
  '{"paypal_email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}',
  10, 5, 4),
('USD', 'United States', 'Wire Transfer', 'bank',
  '{"account_holder": "Account Holder Name", "account_number": "Account Number", "routing_number": "Routing Number", "bank_name": "Bank Name"}',
  '{"routing_number": {"pattern": "^[0-9]{9}$", "required": true}}',
  100, 60, 5),
('USD', 'United States', 'ACH Transfer', 'bank',
  '{"account_holder": "Account Holder Name", "account_number": "Account Number", "routing_number": "Routing Number"}',
  '{"routing_number": {"pattern": "^[0-9]{9}$", "required": true}}',
  10, 120, 6),
('USD', 'United States', 'Chase Bank', 'bank',
  '{"account_holder": "Account Holder Name", "account_number": "Account Number"}',
  '{"account_number": {"required": true}}',
  10, 30, 7),
('USD', 'United States', 'Bank of America', 'bank',
  '{"account_holder": "Account Holder Name", "account_number": "Account Number"}',
  '{"account_number": {"required": true}}',
  10, 30, 8),
('USD', 'International', 'Wise (TransferWise)', 'e_wallet',
  '{"email": "Wise Email", "account_holder": "Account Holder Name"}',
  '{"email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}',
  5, 10, 9),
('USD', 'International', 'Western Union', 'remittance',
  '{"recipient_name": "Recipient Full Name", "country": "Destination Country"}',
  '{"recipient_name": {"required": true}}',
  50, 60, 10)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Block Trade Requests Table
-- =====================================================

CREATE TABLE IF NOT EXISTS p2p_block_trade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
  token VARCHAR(10) NOT NULL,
  fiat_currency VARCHAR(10) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  target_price DECIMAL(20, 8),
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'negotiating', 'approved', 'in_progress', 'completed', 'cancelled')),
  admin_notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for block trade requests
ALTER TABLE p2p_block_trade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own block trade requests" ON p2p_block_trade_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create block trade requests" ON p2p_block_trade_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage block trade requests" ON p2p_block_trade_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Index for block trade requests
CREATE INDEX IF NOT EXISTS idx_block_trade_user ON p2p_block_trade_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_block_trade_status ON p2p_block_trade_requests(status);

-- =====================================================
-- KURDISH DIASPORA - Germany (EUR) - 8 Payment Methods
-- Large Kurdish population: ~1.5 million
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order, notes)
VALUES
('EUR', 'Germany', 'Sparkasse', 'bank',
  '{"account_holder": "Kontoinhaber", "iban": "IBAN"}',
  '{"iban": {"pattern": "^DE[0-9]{20}$", "required": true}}',
  10, 30, 20, 'Popular among Kurdish diaspora in Germany'),
('EUR', 'Germany', 'Commerzbank', 'bank',
  '{"account_holder": "Kontoinhaber", "iban": "IBAN"}',
  '{"iban": {"pattern": "^DE[0-9]{20}$", "required": true}}',
  10, 30, 21, NULL),
('EUR', 'Germany', 'Postbank', 'bank',
  '{"account_holder": "Kontoinhaber", "iban": "IBAN"}',
  '{"iban": {"pattern": "^DE[0-9]{20}$", "required": true}}',
  10, 30, 22, NULL),
('EUR', 'Germany', 'DKB', 'bank',
  '{"account_holder": "Kontoinhaber", "iban": "IBAN"}',
  '{"iban": {"pattern": "^DE[0-9]{20}$", "required": true}}',
  10, 30, 23, NULL),
('EUR', 'Germany', 'PayPal DE', 'e_wallet',
  '{"paypal_email": "PayPal E-Mail"}',
  '{"paypal_email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}',
  5, 5, 24, NULL),
('EUR', 'Germany', 'Klarna', 'e_wallet',
  '{"klarna_email": "Klarna E-Mail", "phone": "Telefonnummer"}',
  '{"klarna_email": {"required": true}}',
  10, 10, 25, NULL),
('EUR', 'Germany', 'Azimo (to Kurdistan)', 'remittance',
  '{"recipient_name": "Empfängername", "recipient_country": "Zielland"}',
  '{"recipient_name": {"required": true}}',
  20, 60, 26, 'Money transfer to Kurdistan Region'),
('EUR', 'Germany', 'Western Union DE', 'remittance',
  '{"recipient_name": "Empfängername", "mtcn": "MTCN (optional)"}',
  '{"recipient_name": {"required": true}}',
  50, 30, 27, 'Cash pickup in Kurdistan')
ON CONFLICT DO NOTHING;

-- =====================================================
-- KURDISH DIASPORA - Sweden (SEK) - 6 Payment Methods
-- Kurdish population: ~100,000
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order, notes)
VALUES
('SEK', 'Sweden', 'Swish', 'mobile_payment',
  '{"phone_number": "Mobilnummer (07x)"}',
  '{"phone_number": {"pattern": "^07[0-9]{8}$", "required": true}}',
  100, 5, 1, 'Most popular in Sweden'),
('SEK', 'Sweden', 'Nordea', 'bank',
  '{"account_holder": "Kontoinnehavare", "clearing": "Clearingnummer", "account": "Kontonummer"}',
  '{"clearing": {"pattern": "^[0-9]{4}$", "required": true}}',
  100, 30, 2, NULL),
('SEK', 'Sweden', 'SEB', 'bank',
  '{"account_holder": "Kontoinnehavare", "iban": "IBAN"}',
  '{"iban": {"pattern": "^SE[0-9]{22}$", "required": true}}',
  100, 30, 3, NULL),
('SEK', 'Sweden', 'Swedbank', 'bank',
  '{"account_holder": "Kontoinnehavare", "iban": "IBAN"}',
  '{"iban": {"pattern": "^SE[0-9]{22}$", "required": true}}',
  100, 30, 4, NULL),
('SEK', 'Sweden', 'Handelsbanken', 'bank',
  '{"account_holder": "Kontoinnehavare", "iban": "IBAN"}',
  '{"iban": {"pattern": "^SE[0-9]{22}$", "required": true}}',
  100, 30, 5, NULL),
('SEK', 'Sweden', 'Ria Money Transfer', 'remittance',
  '{"recipient_name": "Mottagarens namn", "recipient_phone": "Mottagarens telefon"}',
  '{"recipient_name": {"required": true}}',
  200, 60, 6, 'Send to Kurdistan')
ON CONFLICT DO NOTHING;

-- =====================================================
-- KURDISH DIASPORA - United Kingdom (GBP) - 8 Payment Methods
-- Kurdish population: ~50,000+
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order, notes)
VALUES
('GBP', 'United Kingdom', 'Faster Payments', 'bank',
  '{"account_holder": "Account Name", "sort_code": "Sort Code", "account_number": "Account Number"}',
  '{"sort_code": {"pattern": "^[0-9]{6}$", "required": true}, "account_number": {"pattern": "^[0-9]{8}$", "required": true}}',
  10, 5, 1, 'Instant UK bank transfer'),
('GBP', 'United Kingdom', 'Barclays', 'bank',
  '{"account_holder": "Account Name", "sort_code": "Sort Code", "account_number": "Account Number"}',
  '{"sort_code": {"pattern": "^[0-9]{6}$", "required": true}}',
  10, 30, 2, NULL),
('GBP', 'United Kingdom', 'HSBC UK', 'bank',
  '{"account_holder": "Account Name", "sort_code": "Sort Code", "account_number": "Account Number"}',
  '{"sort_code": {"pattern": "^[0-9]{6}$", "required": true}}',
  10, 30, 3, NULL),
('GBP', 'United Kingdom', 'Lloyds Bank', 'bank',
  '{"account_holder": "Account Name", "sort_code": "Sort Code", "account_number": "Account Number"}',
  '{"sort_code": {"pattern": "^[0-9]{6}$", "required": true}}',
  10, 30, 4, NULL),
('GBP', 'United Kingdom', 'Monzo', 'mobile_payment',
  '{"monzo_tag": "Monzo.me Username", "phone": "Phone Number"}',
  '{"monzo_tag": {"required": true}}',
  5, 5, 5, 'Popular digital bank'),
('GBP', 'United Kingdom', 'Revolut UK', 'e_wallet',
  '{"revolut_tag": "Revolut Tag (@)", "phone": "Phone Number"}',
  '{"revolut_tag": {"pattern": "^@[a-z0-9]+$", "required": true}}',
  5, 5, 6, NULL),
('GBP', 'United Kingdom', 'PayPal UK', 'e_wallet',
  '{"paypal_email": "PayPal Email"}',
  '{"paypal_email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}',
  10, 5, 7, NULL),
('GBP', 'United Kingdom', 'WorldRemit', 'remittance',
  '{"recipient_name": "Recipient Name", "recipient_phone": "Recipient Phone", "destination": "Destination Country"}',
  '{"recipient_name": {"required": true}}',
  20, 30, 8, 'Send to Iraq/Kurdistan')
ON CONFLICT DO NOTHING;

-- =====================================================
-- KURDISH DIASPORA - France (EUR) - 6 Payment Methods
-- Kurdish population: ~200,000
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order, notes)
VALUES
('EUR', 'France', 'Crédit Agricole', 'bank',
  '{"account_holder": "Titulaire du compte", "iban": "IBAN", "bic": "BIC"}',
  '{"iban": {"pattern": "^FR[0-9]{25}$", "required": true}}',
  10, 30, 30, NULL),
('EUR', 'France', 'Société Générale', 'bank',
  '{"account_holder": "Titulaire du compte", "iban": "IBAN"}',
  '{"iban": {"pattern": "^FR[0-9]{25}$", "required": true}}',
  10, 30, 31, NULL),
('EUR', 'France', 'La Banque Postale', 'bank',
  '{"account_holder": "Titulaire du compte", "iban": "IBAN"}',
  '{"iban": {"pattern": "^FR[0-9]{25}$", "required": true}}',
  10, 30, 32, 'Popular for remittances'),
('EUR', 'France', 'Lydia', 'mobile_payment',
  '{"lydia_phone": "Numéro Lydia"}',
  '{"lydia_phone": {"pattern": "^\\+33[0-9]{9}$", "required": true}}',
  5, 5, 33, 'Popular mobile payment app'),
('EUR', 'France', 'PayPal FR', 'e_wallet',
  '{"paypal_email": "Email PayPal"}',
  '{"paypal_email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}',
  10, 5, 34, NULL),
('EUR', 'France', 'MoneyGram FR', 'remittance',
  '{"recipient_name": "Nom du bénéficiaire", "reference_number": "Numéro de référence"}',
  '{"recipient_name": {"required": true}}',
  30, 30, 35, 'Cash pickup in Kurdistan')
ON CONFLICT DO NOTHING;

-- =====================================================
-- KURDISH DIASPORA - Netherlands (EUR) - 5 Payment Methods
-- Kurdish population: ~80,000
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order, notes)
VALUES
('EUR', 'Netherlands', 'iDEAL', 'bank',
  '{"bank_name": "Bank", "account_holder": "Rekeninghouder"}',
  '{"bank_name": {"required": true}}',
  5, 5, 40, 'Most popular Dutch payment'),
('EUR', 'Netherlands', 'ABN AMRO', 'bank',
  '{"account_holder": "Rekeninghouder", "iban": "IBAN"}',
  '{"iban": {"pattern": "^NL[0-9]{2}[A-Z]{4}[0-9]{10}$", "required": true}}',
  10, 30, 41, NULL),
('EUR', 'Netherlands', 'Rabobank', 'bank',
  '{"account_holder": "Rekeninghouder", "iban": "IBAN"}',
  '{"iban": {"pattern": "^NL[0-9]{2}[A-Z]{4}[0-9]{10}$", "required": true}}',
  10, 30, 42, NULL),
('EUR', 'Netherlands', 'Bunq', 'mobile_payment',
  '{"bunq_iban": "Bunq IBAN", "account_holder": "Rekeninghouder"}',
  '{"bunq_iban": {"required": true}}',
  5, 5, 43, 'Digital bank'),
('EUR', 'Netherlands', 'Tikkie', 'mobile_payment',
  '{"tikkie_link": "Tikkie Link or Phone"}',
  '{"tikkie_link": {"required": true}}',
  5, 5, 44, 'Popular P2P payment')
ON CONFLICT DO NOTHING;

-- =====================================================
-- KURDISH DIASPORA - Belgium (EUR) - 4 Payment Methods
-- Kurdish population: ~50,000
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order, notes)
VALUES
('EUR', 'Belgium', 'Bancontact', 'card',
  '{"card_number": "Card Number"}',
  '{"card_number": {"required": true}}',
  10, 5, 50, 'Belgian debit card system'),
('EUR', 'Belgium', 'KBC', 'bank',
  '{"account_holder": "Rekeninghouder", "iban": "IBAN"}',
  '{"iban": {"pattern": "^BE[0-9]{14}$", "required": true}}',
  10, 30, 51, NULL),
('EUR', 'Belgium', 'BNP Paribas Fortis', 'bank',
  '{"account_holder": "Rekeninghouder", "iban": "IBAN"}',
  '{"iban": {"pattern": "^BE[0-9]{14}$", "required": true}}',
  10, 30, 52, NULL),
('EUR', 'Belgium', 'Payconiq', 'mobile_payment',
  '{"phone_number": "GSM Nummer"}',
  '{"phone_number": {"pattern": "^\\+32[0-9]{9}$", "required": true}}',
  5, 5, 53, 'Mobile payment app')
ON CONFLICT DO NOTHING;

-- =====================================================
-- KURDISH DIASPORA - Austria (EUR) - 4 Payment Methods
-- Kurdish population: ~50,000
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order, notes)
VALUES
('EUR', 'Austria', 'Erste Bank', 'bank',
  '{"account_holder": "Kontoinhaber", "iban": "IBAN"}',
  '{"iban": {"pattern": "^AT[0-9]{18}$", "required": true}}',
  10, 30, 60, NULL),
('EUR', 'Austria', 'Raiffeisen Austria', 'bank',
  '{"account_holder": "Kontoinhaber", "iban": "IBAN"}',
  '{"iban": {"pattern": "^AT[0-9]{18}$", "required": true}}',
  10, 30, 61, NULL),
('EUR', 'Austria', 'Bank Austria', 'bank',
  '{"account_holder": "Kontoinhaber", "iban": "IBAN"}',
  '{"iban": {"pattern": "^AT[0-9]{18}$", "required": true}}',
  10, 30, 62, NULL),
('EUR', 'Austria', 'EPS', 'bank',
  '{"bank_name": "Bank", "account_holder": "Kontoinhaber"}',
  '{"bank_name": {"required": true}}',
  10, 10, 63, 'Austrian online banking')
ON CONFLICT DO NOTHING;

-- =====================================================
-- KURDISH DIASPORA - Switzerland (CHF) - 4 Payment Methods
-- Kurdish population: ~30,000
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order, notes)
VALUES
('CHF', 'Switzerland', 'TWINT', 'mobile_payment',
  '{"twint_phone": "Mobile Number"}',
  '{"twint_phone": {"pattern": "^\\+41[0-9]{9}$", "required": true}}',
  10, 5, 1, 'Most popular Swiss mobile payment'),
('CHF', 'Switzerland', 'UBS', 'bank',
  '{"account_holder": "Kontoinhaber", "iban": "IBAN"}',
  '{"iban": {"pattern": "^CH[0-9]{19}$", "required": true}}',
  20, 30, 2, NULL),
('CHF', 'Switzerland', 'Credit Suisse', 'bank',
  '{"account_holder": "Kontoinhaber", "iban": "IBAN"}',
  '{"iban": {"pattern": "^CH[0-9]{19}$", "required": true}}',
  20, 30, 3, NULL),
('CHF', 'Switzerland', 'PostFinance', 'bank',
  '{"account_holder": "Kontoinhaber", "iban": "IBAN"}',
  '{"iban": {"pattern": "^CH[0-9]{19}$", "required": true}}',
  20, 30, 4, 'Popular for remittances')
ON CONFLICT DO NOTHING;

-- =====================================================
-- KURDISH DIASPORA - Norway (NOK) - 4 Payment Methods
-- Kurdish population: ~30,000
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order, notes)
VALUES
('NOK', 'Norway', 'Vipps', 'mobile_payment',
  '{"phone_number": "Mobilnummer"}',
  '{"phone_number": {"pattern": "^\\+47[0-9]{8}$", "required": true}}',
  100, 5, 1, 'Most popular in Norway'),
('NOK', 'Norway', 'DNB', 'bank',
  '{"account_holder": "Kontoinnehaver", "account_number": "Kontonummer"}',
  '{"account_number": {"pattern": "^[0-9]{11}$", "required": true}}',
  100, 30, 2, NULL),
('NOK', 'Norway', 'Nordea NO', 'bank',
  '{"account_holder": "Kontoinnehaver", "account_number": "Kontonummer"}',
  '{"account_number": {"pattern": "^[0-9]{11}$", "required": true}}',
  100, 30, 3, NULL),
('NOK', 'Norway', 'SpareBank 1', 'bank',
  '{"account_holder": "Kontoinnehaver", "account_number": "Kontonummer"}',
  '{"account_number": {"pattern": "^[0-9]{11}$", "required": true}}',
  100, 30, 4, NULL)
ON CONFLICT DO NOTHING;

-- =====================================================
-- KURDISH DIASPORA - Denmark (DKK) - 4 Payment Methods
-- Kurdish population: ~25,000
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order, notes)
VALUES
('DKK', 'Denmark', 'MobilePay', 'mobile_payment',
  '{"phone_number": "Mobilnummer"}',
  '{"phone_number": {"pattern": "^\\+45[0-9]{8}$", "required": true}}',
  50, 5, 1, 'Most popular in Denmark'),
('DKK', 'Denmark', 'Danske Bank', 'bank',
  '{"account_holder": "Kontoindehaver", "reg_number": "Reg. Nr.", "account_number": "Kontonummer"}',
  '{"reg_number": {"pattern": "^[0-9]{4}$", "required": true}}',
  50, 30, 2, NULL),
('DKK', 'Denmark', 'Nordea DK', 'bank',
  '{"account_holder": "Kontoindehaver", "reg_number": "Reg. Nr.", "account_number": "Kontonummer"}',
  '{"reg_number": {"pattern": "^[0-9]{4}$", "required": true}}',
  50, 30, 3, NULL),
('DKK', 'Denmark', 'Jyske Bank', 'bank',
  '{"account_holder": "Kontoindehaver", "reg_number": "Reg. Nr.", "account_number": "Kontonummer"}',
  '{"reg_number": {"pattern": "^[0-9]{4}$", "required": true}}',
  50, 30, 4, NULL)
ON CONFLICT DO NOTHING;

-- =====================================================
-- KURDISH DIASPORA - Australia (AUD) - 4 Payment Methods
-- Kurdish population: ~20,000
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order, notes)
VALUES
('AUD', 'Australia', 'PayID', 'mobile_payment',
  '{"payid": "PayID (Email or Phone)", "account_holder": "Account Name"}',
  '{"payid": {"required": true}}',
  10, 5, 1, 'Instant Australian payments'),
('AUD', 'Australia', 'Commonwealth Bank', 'bank',
  '{"account_holder": "Account Name", "bsb": "BSB", "account_number": "Account Number"}',
  '{"bsb": {"pattern": "^[0-9]{6}$", "required": true}}',
  10, 30, 2, NULL),
('AUD', 'Australia', 'ANZ', 'bank',
  '{"account_holder": "Account Name", "bsb": "BSB", "account_number": "Account Number"}',
  '{"bsb": {"pattern": "^[0-9]{6}$", "required": true}}',
  10, 30, 3, NULL),
('AUD', 'Australia', 'OSKO', 'bank',
  '{"payid": "PayID", "account_holder": "Account Name"}',
  '{"payid": {"required": true}}',
  10, 5, 4, 'Real-time payments')
ON CONFLICT DO NOTHING;

-- =====================================================
-- KURDISH DIASPORA - Canada (CAD) - 4 Payment Methods
-- Kurdish population: ~30,000
-- =====================================================

INSERT INTO payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order, notes)
VALUES
('CAD', 'Canada', 'Interac e-Transfer', 'mobile_payment',
  '{"email": "Email Address", "account_holder": "Account Name"}',
  '{"email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}',
  10, 5, 1, 'Most popular in Canada'),
('CAD', 'Canada', 'TD Bank', 'bank',
  '{"account_holder": "Account Name", "transit": "Transit Number", "account_number": "Account Number"}',
  '{"transit": {"pattern": "^[0-9]{5}$", "required": true}}',
  10, 30, 2, NULL),
('CAD', 'Canada', 'RBC', 'bank',
  '{"account_holder": "Account Name", "transit": "Transit Number", "account_number": "Account Number"}',
  '{"transit": {"pattern": "^[0-9]{5}$", "required": true}}',
  10, 30, 3, NULL),
('CAD', 'Canada', 'WISE CAD', 'e_wallet',
  '{"email": "Wise Email", "account_holder": "Account Name"}',
  '{"email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}',
  10, 15, 4, 'Low-fee international')
ON CONFLICT DO NOTHING;

-- =====================================================
-- Add new currencies to support diaspora
-- =====================================================

-- Note: FiatCurrency type in p2p-fiat.ts needs to be updated to include:
-- SEK (Swedish Krona), GBP (British Pound), CHF (Swiss Franc),
-- NOK (Norwegian Krone), DKK (Danish Krone), AUD (Australian Dollar), CAD (Canadian Dollar)

-- =====================================================
-- Summary: 110+ Payment Methods Total
-- Turkey: 15 (Banks + E-wallets + Mobile)
-- Iraq: 10 (Banks + Mobile + E-wallets + Cash)
-- Iran: 10 (Banks + Card-to-Card + Mobile + Cash)
-- Europe General: 10 (SEPA + Banks + E-wallets)
-- USA: 10 (Mobile + Banks + E-wallets + Remittance)
-- Germany: 8 (Banks + E-wallets + Remittance - Kurdish Diaspora)
-- Sweden: 6 (Banks + Mobile + Remittance - Kurdish Diaspora)
-- UK: 8 (Banks + Mobile + E-wallets + Remittance - Kurdish Diaspora)
-- France: 6 (Banks + Mobile + Remittance - Kurdish Diaspora)
-- Netherlands: 5 (Banks + Mobile - Kurdish Diaspora)
-- Belgium: 4 (Banks + Mobile - Kurdish Diaspora)
-- Austria: 4 (Banks - Kurdish Diaspora)
-- Switzerland: 4 (Banks + Mobile - Kurdish Diaspora)
-- Norway: 4 (Banks + Mobile - Kurdish Diaspora)
-- Denmark: 4 (Banks + Mobile - Kurdish Diaspora)
-- Australia: 4 (Banks + Mobile - Kurdish Diaspora)
-- Canada: 4 (Banks + Mobile - Kurdish Diaspora)
-- =====================================================
