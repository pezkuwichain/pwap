import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Users } from 'lucide-react';

interface TeamMember {
  name: string;
  role: string;
  description: string;
  image: string;
}

const TeamSection: React.FC = () => {
  const { t } = useTranslation();
  const teamMembers: TeamMember[] = [
    {
      name: "Satoshi Qazi Muhammed",
      role: t('teamSection.chiefArchitect'),
      description: t('teamSection.chiefArchitectDesc'),
      image: "https://d64gsuwffb70l.cloudfront.net/68ec477a0a2fa844d6f9df15_1760358016604_9ae228b4.webp"
    },
    {
      name: "Abdurrahman Qasimlo",
      role: t('teamSection.govLead'),
      description: t('teamSection.govLeadDesc'),
      image: "https://d64gsuwffb70l.cloudfront.net/68ec477a0a2fa844d6f9df15_1760358018357_f19e128d.webp"
    },
    {
      name: "Abdusselam Barzani",
      role: t('teamSection.protocolEngineer'),
      description: t('teamSection.protocolEngineerDesc'),
      image: "https://d64gsuwffb70l.cloudfront.net/68ec477a0a2fa844d6f9df15_1760358020150_1ea35457.webp"
    },
    {
      name: "Ihsan Nuri",
      role: t('teamSection.securityAdvisor'),
      description: t('teamSection.securityAdvisorDesc'),
      image: "https://d64gsuwffb70l.cloudfront.net/68ec477a0a2fa844d6f9df15_1760358021872_362f1214.webp"
    },
    {
      name: "Seyh Said",
      role: t('teamSection.communityDirector'),
      description: t('teamSection.communityDirectorDesc'),
      image: "https://d64gsuwffb70l.cloudfront.net/68ec477a0a2fa844d6f9df15_1760358023648_4bb8f4c7.webp"
    },
    {
      name: "Seyyid Riza",
      role: t('teamSection.treasuryManager'),
      description: t('teamSection.treasuryManagerDesc'),
      image: "https://d64gsuwffb70l.cloudfront.net/68ec477a0a2fa844d6f9df15_1760358025533_d9df77a9.webp"
    },
    {
      name: "Beritan",
      role: t('teamSection.devRelations'),
      description: t('teamSection.devRelationsDesc'),
      image: "https://d64gsuwffb70l.cloudfront.net/68ec477a0a2fa844d6f9df15_1760358027281_9254657a.webp"
    },
    {
      name: "Mashuk Xaznevi",
      role: t('teamSection.researchLead'),
      description: t('teamSection.researchLeadDesc'),
      image: "https://d64gsuwffb70l.cloudfront.net/68ec477a0a2fa844d6f9df15_1760358029000_3ffc04bc.webp"
    }
  ];

  return (
    <section className="py-16 bg-gradient-to-b from-gray-900 to-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-kurdish-green/20 text-kurdish-green border-kurdish-green/30">
            <Users className="w-4 h-4 mr-2" />
            {t('teamSection.title')}
          </Badge>
          <h2 className="text-4xl font-bold text-white mb-4">
            {t('teamSection.subtitle')}
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {t('teamSection.description')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {teamMembers.map((member, index) => (
            <Card key={index} className="bg-gray-900/50 border-gray-800 hover:border-kurdish-green/50 transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-kurdish-green via-kurdish-red to-kurdish-yellow p-1 mb-4">
                    <img 
                      src={member.image} 
                      alt={member.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-1 group-hover:text-kurdish-green transition-colors">
                    {member.name}
                  </h3>
                  <Badge className="mb-3 bg-kurdish-red/20 text-kurdish-red border-kurdish-red/30">
                    {member.role}
                  </Badge>
                  <p className="text-gray-400 text-sm">
                    {member.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TeamSection;