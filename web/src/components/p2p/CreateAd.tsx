import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useP2PIdentity } from '@/contexts/P2PIdentityContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  createFiatOffer,
  getPaymentMethods,
  validatePaymentDetails,
  type PaymentMethod,
  type FiatCurrency,
  type CryptoToken
} from '@shared/lib/p2p-fiat';

interface CreateAdProps {
  onAdCreated: () => void;
}

export function CreateAd({ onAdCreated }: CreateAdProps) {
  const { t } = useTranslation();
  const { selectedAccount } = usePezkuwi();
  const { userId } = useP2PIdentity();
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Form fields
  const [adType, setAdType] = useState<'buy' | 'sell'>('sell');
  const [token, setToken] = useState<CryptoToken>('HEZ');
  const [amountCrypto, setAmountCrypto] = useState('');
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrency>('TRY');
  const [fiatAmount, setFiatAmount] = useState('');
  const [paymentDetails, setPaymentDetails] = useState<Record<string, string>>({});
  const [timeLimit, setTimeLimit] = useState(30);
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxOrderAmount, setMaxOrderAmount] = useState('');

  // Load payment methods when currency changes
  useEffect(() => {
    const loadPaymentMethods = async () => {
      const methods = await getPaymentMethods(fiatCurrency);
      setPaymentMethods(methods);
      setSelectedPaymentMethod(null);
      setPaymentDetails({});
    };
    loadPaymentMethods();
  }, [fiatCurrency]);

  // Calculate price per unit
  const pricePerUnit = amountCrypto && fiatAmount 
    ? (parseFloat(fiatAmount) / parseFloat(amountCrypto)).toFixed(2)
    : '0';

  const handlePaymentMethodChange = (methodId: string) => {
    const method = paymentMethods.find(m => m.id === methodId);
    setSelectedPaymentMethod(method || null);
    
    // Initialize payment details with empty values
    if (method) {
      const initialDetails: Record<string, string> = {};
      Object.keys(method.fields).forEach(field => {
        initialDetails[field] = '';
      });
      setPaymentDetails(initialDetails);
    }
  };

  const handlePaymentDetailChange = (field: string, value: string) => {
    setPaymentDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateAd = async () => {
    if (!selectedAccount || !userId) {
      toast.error(t('p2p.connectWalletAndLogin'));
      return;
    }

    if (!selectedPaymentMethod) {
      toast.error(t('p2pCreate.selectPaymentMethodError'));
      return;
    }

    // Validate payment details
    const validation = validatePaymentDetails(
      paymentDetails,
      selectedPaymentMethod.validation_rules
    );

    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError);
      return;
    }

    // Validate amounts
    const cryptoAmt = parseFloat(amountCrypto);
    const fiatAmt = parseFloat(fiatAmount);

    if (!cryptoAmt || cryptoAmt <= 0) {
      toast.error(t('p2pCreate.invalidCryptoAmount'));
      return;
    }

    if (!fiatAmt || fiatAmt <= 0) {
      toast.error(t('p2pCreate.invalidFiatAmount'));
      return;
    }

    if (selectedPaymentMethod.min_trade_amount && fiatAmt < selectedPaymentMethod.min_trade_amount) {
      toast.error(t('p2pCreate.minTradeAmount', { amount: selectedPaymentMethod.min_trade_amount, currency: fiatCurrency }));
      return;
    }

    if (selectedPaymentMethod.max_trade_amount && fiatAmt > selectedPaymentMethod.max_trade_amount) {
      toast.error(t('p2pCreate.maxTradeAmount', { amount: selectedPaymentMethod.max_trade_amount, currency: fiatCurrency }));
      return;
    }

    setLoading(true);

    try {
      await createFiatOffer({
        userId,
        sellerWallet: selectedAccount.address,
        token,
        amountCrypto: cryptoAmt,
        fiatCurrency,
        fiatAmount: fiatAmt,
        paymentMethodId: selectedPaymentMethod.id,
        paymentDetails,
        timeLimitMinutes: timeLimit,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : undefined,
        maxOrderAmount: maxOrderAmount ? parseFloat(maxOrderAmount) : undefined,
        adType,
      });

      onAdCreated();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Create ad error:', error);
      toast.error(t('p2pCreate.failedToCreate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">{t('p2pCreate.title')}</CardTitle>
        <CardDescription>
          {t('p2pCreate.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ad Type Selection */}
        <div>
          <Label>{t('p2pCreate.iWantTo')}</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button
              type="button"
              variant={adType === 'sell' ? 'default' : 'outline'}
              className={adType === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}
              onClick={() => setAdType('sell')}
            >
              {t('p2pCreate.sellToken', { token })}
            </Button>
            <Button
              type="button"
              variant={adType === 'buy' ? 'default' : 'outline'}
              className={adType === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''}
              onClick={() => setAdType('buy')}
            >
              {t('p2pCreate.buyToken', { token })}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {adType === 'sell'
              ? t('p2pCreate.sellDescription')
              : t('p2pCreate.buyDescription')}
          </p>
        </div>

        {/* Crypto Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="token">{t('p2p.token')}</Label>
            <Select value={token} onValueChange={(v) => setToken(v as CryptoToken)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEZ">HEZ</SelectItem>
                <SelectItem value="PEZ">PEZ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="amountCrypto">{t('p2pCreate.amountLabel', { token })}</Label>
            <Input
              id="amountCrypto"
              type="number"
              step="0.01"
              value={amountCrypto}
              onChange={e => setAmountCrypto(e.target.value)}
              placeholder={t('p2pCreate.amountPlaceholder')}
              className="placeholder:text-gray-500 placeholder:opacity-50"
            />
          </div>
        </div>

        {/* Fiat Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fiatCurrency">{t('p2pCreate.fiatCurrency')}</Label>
            <Select value={fiatCurrency} onValueChange={(v) => setFiatCurrency(v as FiatCurrency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Primary regions - Kurdistan & neighboring */}
                <SelectItem value="TRY">🇹🇷 Turkish Lira (TRY) - Bakur</SelectItem>
                <SelectItem value="IQD">🇮🇶 Iraqi Dinar (IQD) - Başûr</SelectItem>
                <SelectItem value="IRR">🇮🇷 Iranian Rial (IRR) - Rojhilat</SelectItem>
                {/* Eurozone diaspora */}
                <SelectItem value="EUR">🇪🇺 Euro (EUR) - EU</SelectItem>
                {/* Other diaspora regions */}
                <SelectItem value="USD">🇺🇸 US Dollar (USD)</SelectItem>
                <SelectItem value="GBP">🇬🇧 British Pound (GBP)</SelectItem>
                <SelectItem value="SEK">🇸🇪 Swedish Krona (SEK)</SelectItem>
                <SelectItem value="CHF">🇨🇭 Swiss Franc (CHF)</SelectItem>
                <SelectItem value="NOK">🇳🇴 Norwegian Krone (NOK)</SelectItem>
                <SelectItem value="DKK">🇩🇰 Danish Krone (DKK)</SelectItem>
                <SelectItem value="AUD">🇦🇺 Australian Dollar (AUD)</SelectItem>
                <SelectItem value="CAD">🇨🇦 Canadian Dollar (CAD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="fiatAmount">{t('p2pCreate.totalFiatAmount', { currency: fiatCurrency })}</Label>
            <Input
              id="fiatAmount"
              type="number"
              step="0.01"
              value={fiatAmount}
              onChange={e => setFiatAmount(e.target.value)}
              placeholder={t('p2pCreate.amountPlaceholder')}
              className="placeholder:text-gray-500 placeholder:opacity-50"
            />
          </div>
        </div>

        {/* Price Display */}
        {amountCrypto && fiatAmount && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-gray-400">{t('p2pCreate.pricePerToken', { token })}</p>
            <p className="text-2xl font-bold text-green-400">
              {pricePerUnit} {fiatCurrency}
            </p>
          </div>
        )}

        {/* Payment Method */}
        <div>
          <Label htmlFor="paymentMethod">{t('p2pCreate.paymentMethod')}</Label>
          <Select onValueChange={handlePaymentMethodChange}>
            <SelectTrigger>
              <SelectValue placeholder={t('p2pCreate.selectPaymentMethod')} />
            </SelectTrigger>
            <SelectContent>
              {paymentMethods.map(method => (
                <SelectItem key={method.id} value={method.id}>
                  {method.method_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dynamic Payment Details Fields */}
        {selectedPaymentMethod && Object.keys(selectedPaymentMethod.fields).length > 0 && (
          <div className="space-y-4 p-4 border border-gray-700 rounded-lg">
            <h3 className="font-semibold text-white">{t('p2pCreate.paymentDetails')}</h3>
            {Object.entries(selectedPaymentMethod.fields).map(([field, placeholder]) => (
              <div key={field}>
                <Label htmlFor={field}>
                  {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Label>
                <Input
                  id={field}
                  value={paymentDetails[field] || ''}
                  onChange={(e) => handlePaymentDetailChange(field, e.target.value)}
                  placeholder={placeholder}
                  className="placeholder:text-gray-500 placeholder:opacity-50"
                />
              </div>
            ))}
          </div>
        )}

        {/* Order Limits */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="minOrder">{t('p2pCreate.minOrder')}</Label>
            <Input
              id="minOrder"
              type="number"
              step="0.01"
              value={minOrderAmount}
              onChange={e => setMinOrderAmount(e.target.value)}
              placeholder={t('p2pCreate.minOrderPlaceholder')}
              className="placeholder:text-gray-500 placeholder:opacity-50"
            />
          </div>
          <div>
            <Label htmlFor="maxOrder">{t('p2pCreate.maxOrder')}</Label>
            <Input
              id="maxOrder"
              type="number"
              step="0.01"
              value={maxOrderAmount}
              onChange={e => setMaxOrderAmount(e.target.value)}
              placeholder={t('p2pCreate.maxOrderPlaceholder')}
              className="placeholder:text-gray-500 placeholder:opacity-50"
            />
          </div>
        </div>

        {/* Time Limit */}
        <div>
          <Label htmlFor="timeLimit">{t('p2pCreate.paymentTimeLimit')}</Label>
          <Select value={timeLimit.toString()} onValueChange={(v) => setTimeLimit(parseInt(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">{t('p2pCreate.15min')}</SelectItem>
              <SelectItem value="30">{t('p2pCreate.30min')}</SelectItem>
              <SelectItem value="60">{t('p2pCreate.1hour')}</SelectItem>
              <SelectItem value="120">{t('p2pCreate.2hours')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleCreateAd} 
          className="w-full"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('p2pCreate.creatingOffer')}
            </>
          ) : (
            t('p2pCreate.createOffer')
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
