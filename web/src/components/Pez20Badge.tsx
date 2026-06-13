import React from 'react';

/**
 * Small pill marking a token as a Pezkuwi token-standard asset.
 * PEZ-20 = fungible standard (pallet-assets on Asset Hub), PEZ-721 = NFT standard.
 * See docs.pezkuwichain.io → Token Standards.
 */
export const Pez20Badge: React.FC<{ standard?: 'PEZ-20' | 'PEZ-721'; className?: string }> = ({
  standard = 'PEZ-20',
  className = '',
}) => (
  <a
    href="https://docs.pezkuwichain.io/token-standards"
    target="_blank"
    rel="noopener noreferrer"
    title={`${standard} token standard on Pezkuwi Asset Hub`}
    className={
      'inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 ' +
      'px-2 py-0.5 text-[10px] font-semibold tracking-wide text-blue-300 ' +
      'hover:bg-blue-500/20 transition-colors no-underline ' +
      className
    }
  >
    {standard}
  </a>
);

export default Pez20Badge;
