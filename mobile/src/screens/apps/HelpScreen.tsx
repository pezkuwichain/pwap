import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';

interface FAQItem {
  id: number;
  question: string;
  questionKu: string;
  answer: string;
  answerKu: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 1,
    questionKu: 'Berîka PWAP çi ye?',
    question: 'What is PWAP Wallet?',
    answerKu: 'PWAP berîkek dijîtal e ku ji bo rêvebirina tokenên HEZ û beşdariya aboriya dijital a Kurdistanê hatiye çêkirin. Ew piştgiriya blockchain a Pezkuwi dike.',
    answer: 'PWAP is a digital wallet built for managing HEZ tokens and participating in the Kurdistan digital economy. It supports the Pezkuwi blockchain.',
  },
  {
    id: 2,
    questionKu: 'Ez çawa dikaram hesabek çêkim?',
    question: 'How do I create an account?',
    answerKu: 'Li ser rûpela destpêkê, "Hesabek Nû" bitikîne. Pêdivî ye ku hûn navnîşanek e-nameyê an jî Google Sign-In bikar bînin. Piştî qeydkirinê, berîka we bixweber tê çêkirin.',
    answer: 'On the start page, tap "New Account". You need to use an email address or Google Sign-In. After registration, your wallet is automatically created.',
  },
  {
    id: 3,
    questionKu: 'Tokenên HEZ çi ne?',
    question: 'What are HEZ tokens?',
    answerKu: 'HEZ tokena sereke ya tora Pezkuwi ye. Ew ji bo dravdanan, stakingê, rêveberiyê, û beşdariya aboriya dijital tê bikaranîn.',
    answer: 'HEZ is the native token of the Pezkuwi network. It is used for transactions, staking, governance, and participating in the digital economy.',
  },
  {
    id: 4,
    questionKu: 'Ez çawa dikaram HEZ bişînim?',
    question: 'How do I send HEZ tokens?',
    answerKu: 'Li ser rûpela sereke "Bişîne" bitikîne, navnîşana wergir binivîsîne an QR kodê bişkîne, mîqdar binivîsîne û piştrast bike.',
    answer: 'Tap "Send" on the home screen, enter the recipient address or scan a QR code, enter the amount, and confirm.',
  },
  {
    id: 5,
    questionKu: 'Staking çi ye û ez çawa dikim?',
    question: 'What is staking and how do I stake?',
    answerKu: 'Staking tê wê maneyê ku hûn tokenên xwe dixin pêvajoyê da ku torê piştgirî bikin û xelatên wê bistînin. Biçin beşa "Staking" û rêwerzên li wir bişopînin.',
    answer: 'Staking means locking your tokens to support the network and earn rewards. Go to the "Staking" section and follow the instructions there.',
  },
  {
    id: 6,
    questionKu: 'Seed phrase min çi ye û çima girîng e?',
    question: 'What is my seed phrase and why is it important?',
    answerKu: 'Seed phrase rêzek 12 peyvan e ku mifteya taybetî ya we temsîl dike. Ew yekane rêya vegerandina berîka we ye heke cîhaza we winda bibe. Tu carî bi kesî re parve nekin!',
    answer: 'Your seed phrase is a 12-word sequence representing your private key. It is the only way to recover your wallet if your device is lost. Never share it with anyone!',
  },
  {
    id: 7,
    questionKu: 'Bereketli çi ye?',
    question: 'What is Bereketli?',
    answerKu: 'Bereketli sîstema aboriya taxê ye ku di nav PWAP de hatiye entegrekirin. Ew dike ku hûn bi cîranên xwe re bazirganiyê bikin û xizmetên herêmî bikar bînin.',
    answer: 'Bereketli is the neighborhood economy system integrated into PWAP. It allows you to trade with your neighbors and use local services.',
  },
  {
    id: 8,
    questionKu: 'Heke şîfreyê ji bîr bikim çi bikim?',
    question: 'What if I forget my password?',
    answerKu: 'Hûn dikarin bi seed phrase ya xwe re berîka xwe ji nû ve vegerînin. Heke seed phrase jî tune be, mixabin berîk nayê vegerandin.',
    answer: 'You can recover your wallet using your seed phrase. If you also lost your seed phrase, unfortunately the wallet cannot be recovered.',
  },
  {
    id: 9,
    questionKu: 'Karmasiyonên dravdanê çiqas in?',
    question: 'What are the transaction fees?',
    answerKu: 'Karmasiyonên tora Pezkuwi pir kêm in, bi gelemperî ji 0.001 HEZ kêmtir in. Ev ji bo piştgirîkirina validatorên torê tê bikaranîn.',
    answer: 'Pezkuwi network fees are very low, typically less than 0.001 HEZ. These are used to support network validators.',
  },
  {
    id: 10,
    questionKu: 'Ez çawa dikaram ji bo rêveberiyê deng bidim?',
    question: 'How can I vote in governance?',
    answerKu: 'Biçin beşa "Rêveberî" û pêşniyarên çalak bibînin. Pêdivî ye ku tokenên HEZ ên stakkirî hebin da ku hûn bikaribin deng bidin.',
    answer: 'Go to the "Governance" section and view active proposals. You need staked HEZ tokens to be able to vote.',
  },
];

const HelpScreen: React.FC = () => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@pezkuwi.com?subject=PWAP%20Support%20Request');
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} />}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🤝</Text>
        <Text style={styles.headerTitle}>Arîkarî & Piştgirî</Text>
        <Text style={styles.headerSubtitle}>Help & Support</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pirsên Pir Tên Pirsîn (FAQ)</Text>
        {FAQ_DATA.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.faqItem, expandedId === item.id && styles.faqItemExpanded]}
            onPress={() => toggleExpand(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.faqHeader}>
              <View style={styles.faqQuestionContainer}>
                <Text style={styles.faqQuestionKu}>{item.questionKu}</Text>
                <Text style={styles.faqQuestion}>{item.question}</Text>
              </View>
              <Text style={styles.faqArrow}>
                {expandedId === item.id ? '▲' : '▼'}
              </Text>
            </View>
            {expandedId === item.id && (
              <View style={styles.faqAnswer}>
                <Text style={styles.faqAnswerTextKu}>{item.answerKu}</Text>
                <Text style={styles.faqAnswerText}>{item.answer}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.contactSection}>
        <Text style={styles.contactTitle}>Hîn jî pirsên te hene?</Text>
        <Text style={styles.contactSubtitle}>Still have questions?</Text>
        <TouchableOpacity style={styles.contactButton} onPress={handleContactSupport}>
          <Text style={styles.contactButtonText}>📧  Têkiliya Piştgiriyê / Contact Support</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Agahdarî / Info</Text>
        <Text style={styles.infoText}>
          Piştgirî bi Kurdî, Tirkî û Îngilîzî peyda dibe.{'\n'}
          Support is available in Kurdish, Turkish, and English.
        </Text>
        <Text style={styles.infoEmail}>support@pezkuwi.com</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: KurdistanColors.kesk,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 12,
  },
  faqItem: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqItemExpanded: {
    borderLeftWidth: 3,
    borderLeftColor: KurdistanColors.kesk,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestionContainer: {
    flex: 1,
    marginRight: 12,
  },
  faqQuestionKu: {
    fontSize: 15,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 2,
  },
  faqQuestion: {
    fontSize: 13,
    color: '#888',
  },
  faqArrow: {
    fontSize: 12,
    color: KurdistanColors.kesk,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  faqAnswerTextKu: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
    marginBottom: 8,
  },
  faqAnswerText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 20,
  },
  contactSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  contactButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  contactButtonText: {
    color: KurdistanColors.spi,
    fontSize: 15,
    fontWeight: '600',
  },
  infoBox: {
    marginHorizontal: 16,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  infoEmail: {
    fontSize: 14,
    color: KurdistanColors.şîn,
    fontWeight: '600',
  },
});

export default HelpScreen;
