import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Diamond, Star, Shield } from 'lucide-react';

export type MerchantTier = 'lite' | 'super' | 'diamond';

interface MerchantTierBadgeProps {
  tier: MerchantTier;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const TIER_CONFIG = {
  lite: {
    labelKey: 'p2pTier.lite',
    icon: Shield,
    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    iconClassName: 'text-gray-400',
    descKey: 'p2pTier.liteDesc',
    merchantKey: 'p2pTier.liteMerchant'
  },
  super: {
    labelKey: 'p2pTier.super',
    icon: Star,
    className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    iconClassName: 'text-yellow-500',
    descKey: 'p2pTier.superDesc',
    merchantKey: 'p2pTier.superMerchant'
  },
  diamond: {
    labelKey: 'p2pTier.diamond',
    icon: Diamond,
    className: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    iconClassName: 'text-purple-500',
    descKey: 'p2pTier.diamondDesc',
    merchantKey: 'p2pTier.diamondMerchant'
  }
};

const SIZE_CONFIG = {
  sm: {
    badge: 'text-[10px] px-1.5 py-0.5',
    icon: 'h-3 w-3'
  },
  md: {
    badge: 'text-xs px-2 py-1',
    icon: 'h-3.5 w-3.5'
  },
  lg: {
    badge: 'text-sm px-3 py-1.5',
    icon: 'h-4 w-4'
  }
};

export function MerchantTierBadge({
  tier,
  size = 'md',
  showLabel = true
}: MerchantTierBadgeProps) {
  const { t } = useTranslation();
  const config = TIER_CONFIG[tier];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${config.className} ${sizeConfig.badge} gap-1 cursor-help`}
          >
            <Icon className={`${sizeConfig.icon} ${config.iconClassName}`} />
            {showLabel && <span>{t(config.labelKey)}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{t(config.merchantKey)}</p>
          <p className="text-xs text-muted-foreground">{t(config.descKey)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Standalone tier icon for compact displays
export function MerchantTierIcon({
  tier,
  size = 'md'
}: {
  tier: MerchantTier;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { t } = useTranslation();
  const config = TIER_CONFIG[tier];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help">
            <Icon className={`${sizeConfig.icon} ${config.iconClassName}`} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{t(config.merchantKey)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default MerchantTierBadge;
