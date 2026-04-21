import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Animated,
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useTranslation} from 'react-i18next';
import {colors} from '../../theme';
import {sendMessage} from '../../api/chat';
import type {ChatMessage} from '../../api/chat';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

const {BereketliSpeech} = NativeModules;
const speechEmitter = new NativeEventEmitter(BereketliSpeech);

type Props = NativeStackScreenProps<Record<string, undefined>, 'AiChat'>;

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AI_AVATAR = require('../../assets/ai-avatar.jpg');

export default function AiChatScreen({navigation}: Props) {
  const {t, i18n} = useTranslation();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const flatListRef = useRef<FlatList<DisplayMessage>>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const VOICE_LOCALES: Record<string, string> = {
    tr: 'tr-TR', en: 'en-US', ar: 'ar-IQ', ckb: 'ckb-IQ', ku: 'ku-TR', fa: 'fa-IR',
  };

  // Pulse animation while listening
  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {toValue: 1.15, duration: 600, useNativeDriver: true}),
          Animated.timing(pulseAnim, {toValue: 1, duration: 600, useNativeDriver: true}),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
    pulseAnim.setValue(1);
  }, [isListening, pulseAnim]);

  // Speech recognition events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSendRef = useRef<any>(null);

  useEffect(() => {
    const resultSub = speechEmitter.addListener('onSpeechResult', (text: string) => {
      setIsListening(false);
      setPartialText('');
      if (text) handleSendRef.current(text);
    });
    const partialSub = speechEmitter.addListener('onSpeechPartial', (text: string) => {
      setPartialText(text);
    });
    const errorSub = speechEmitter.addListener('onSpeechError', () => {
      setIsListening(false);
      setPartialText('');
    });
    return () => {
      resultSub.remove();
      partialSub.remove();
      errorSub.remove();
      BereketliSpeech.destroy();
    };
  }, []);

  const startListening = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    setIsListening(true);
    setPartialText('');
    const locale = VOICE_LOCALES[i18n.language] || 'tr-TR';
    BereketliSpeech.start(locale);
  };

  const stopListening = () => {
    BereketliSpeech.stop();
  };

  const suggestions = [
    {key: 'packages', label: t('chat.suggestPackages')},
    {key: 'food', label: t('chat.suggestFood')},
    {key: 'store', label: t('chat.suggestStore')},
  ];

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      if (!chatStarted) setChatStarted(true);

      const userMsg: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
      };

      setMessages(prev => [...prev, userMsg]);
      setInputText('');
      setLoading(true);

      try {
        const conversation: ChatMessage[] = messages.map(m => ({
          role: m.role,
          content: m.content,
        }));
        conversation.push({role: 'user', content: trimmed});

        const response = await sendMessage(trimmed, conversation);

        const aiMsg: DisplayMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: response.reply,
        };
        setMessages(prev => [...prev, aiMsg]);
      } catch {
        const errorMsg: DisplayMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: t('chat.error'),
        };
        setMessages(prev => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, chatStarted, t],
  );

  handleSendRef.current = handleSend;

  const renderMessage = ({item}: {item: DisplayMessage}) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          msgStyles.row,
          isUser ? msgStyles.rowUser : msgStyles.rowAi,
        ]}>
        {!isUser && (
          <Image source={AI_AVATAR} style={msgStyles.avatar} />
        )}
        <View
          style={[
            msgStyles.bubble,
            isUser ? msgStyles.bubbleUser : msgStyles.bubbleAi,
          ]}>
          <Text
            style={[
              msgStyles.text,
              isUser ? msgStyles.textUser : msgStyles.textAi,
            ]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  const hasText = inputText.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image source={AI_AVATAR} style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerTitle}>Bereketli AI</Text>
            <Text style={styles.headerStatus}>
              {loading ? t('chat.typing') : 'Online'}
            </Text>
          </View>
        </View>
        <View style={{width: 40}} />
      </View>

      {/* Welcome screen OR Chat */}
      {!chatStarted ? (
        <View style={styles.welcomeContainer}>
          <TouchableOpacity
            onPressIn={startListening}
            onPressOut={stopListening}
            activeOpacity={0.8}>
            <Animated.View style={[styles.avatarPulseRing, isListening && {transform: [{scale: pulseAnim}], borderColor: colors.primary}]}>
              <Image source={AI_AVATAR} style={styles.welcomeAvatar} />
            </Animated.View>
          </TouchableOpacity>
          {isListening ? (
            <>
              <Text style={styles.listeningText}>{t('chat.listening')}</Text>
              {partialText ? <Text style={styles.partialText}>{partialText}</Text> : null}
            </>
          ) : (
            <>
              <Text style={styles.welcomeName}>Bereketli AI</Text>
              <Text style={styles.welcomeGreeting}>{t('chat.greeting')}</Text>
              <Text style={styles.holdHint}>{t('chat.holdToTalk')}</Text>
            </>
          )}

          <View style={styles.suggestionsWrap}>
            {suggestions.map(s => (
              <TouchableOpacity
                key={s.key}
                style={styles.suggestionChip}
                onPress={() => handleSend(s.label)}
                activeOpacity={0.7}>
                <Text style={styles.suggestionText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({animated: true})
          }
          ListFooterComponent={
            loading ? (
              <View style={msgStyles.rowAi}>
                <Image source={AI_AVATAR} style={msgStyles.avatar} />
                <View style={msgStyles.typingBubble}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={msgStyles.typingText}>{t('chat.typing')}</Text>
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Input Area */}
      <View style={[styles.inputContainer, {paddingBottom: insets.bottom + 8}]}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('chat.placeholder')}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={1000}
          editable={!loading}
        />
        {hasText ? (
          <TouchableOpacity
            style={[styles.sendButton, loading && {opacity: 0.5}]}
            onPress={() => handleSend(inputText)}
            disabled={loading}
            activeOpacity={0.7}>
            <Icon name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPressIn={startListening}
            onPressOut={stopListening}
            activeOpacity={0.7}
            disabled={loading}>
            <Icon name="microphone" size={22} color={isListening ? '#FFFFFF' : colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const msgStyles = StyleSheet.create({
  row: {flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end'},
  rowUser: {justifyContent: 'flex-end'},
  rowAi: {justifyContent: 'flex-start'},
  avatar: {width: 32, height: 32, borderRadius: 16, marginRight: 8},
  bubble: {maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10},
  bubbleUser: {backgroundColor: colors.primary, borderBottomRightRadius: 4},
  bubbleAi: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  text: {fontSize: 15, lineHeight: 22},
  textUser: {color: '#FFFFFF'},
  textAi: {color: '#1A1A1A'},
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typingText: {fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginLeft: 8},
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F0F2F5'},

  // Header
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backButton: {width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center'},
  headerCenter: {flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8},
  headerAvatar: {width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)'},
  headerTitle: {fontSize: 17, fontWeight: '700', color: '#FFFFFF'},
  headerStatus: {fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1},

  // Welcome
  welcomeContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32},
  avatarPulseRing: {width: 130, height: 130, borderRadius: 65, borderWidth: 4, borderColor: 'transparent', justifyContent: 'center', alignItems: 'center', marginBottom: 16},
  welcomeAvatar: {width: 120, height: 120, borderRadius: 60},
  welcomeName: {fontSize: 22, fontWeight: '800', color: colors.primary, marginBottom: 8},
  welcomeGreeting: {fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 32},
  suggestionsWrap: {width: '100%'},
  suggestionChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  suggestionText: {fontSize: 15, fontWeight: '600', color: colors.primary},
  holdHint: {fontSize: 12, color: '#9CA3AF', marginTop: 8, fontStyle: 'italic'},
  listeningText: {fontSize: 18, fontWeight: '700', color: colors.primary, marginBottom: 8},
  partialText: {fontSize: 14, color: '#6B7280', fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 32},

  // Messages
  messageList: {paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1},

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A1A',
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  micButtonActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
});
