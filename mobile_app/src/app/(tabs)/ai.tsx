
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { askAI } from '../../services/api';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
};

const suggestions = [
  'Explain artificial intelligence simply',
  'Help me write a Python program',
  'Give me some project ideas',
  'What can you help me with?',
];

const welcomeMessage: Message = {
  id: 'welcome',
  sender: 'ai',
  text:
    'Hello! 👋 I am FloodLink AI.\n\nI can help you with coding, learning, writing, projects, explanations, ideas and much more.\n\nWhat would you like to know?',
};

export default function AIScreen() {
  const [messages, setMessages] = useState<Message[]>([
    welcomeMessage,
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  /*
   * Automatically scroll to the latest message.
   */
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({
        animated: true,
      });
    }, 100);
  }, [messages, loading]);

  /*
   * Send message to your existing askAI() function.
   */
  const sendMessage = async (customQuestion?: string) => {
    const question = (customQuestion ?? input).trim();

    if (!question || loading) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: question,
    };

    setMessages((previous) => [
      ...previous,
      userMessage,
    ]);

    setInput('');
    setLoading(true);

    try {
      /*
       * YOUR EXISTING AI BACKEND
       */
      const result = await askAI(question);

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: result.answer,
      };

      setMessages((previous) => [
        ...previous,
        aiMessage,
      ]);
    } catch (error) {
      console.error('AI Chat Error:', error);

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        sender: 'ai',
        text:
          'Sorry, I could not connect to the AI backend.\n\nPlease check that your backend server is running and try again.',
      };

      setMessages((previous) => [
        ...previous,
        errorMessage,
      ]);
    } finally {
      setLoading(false);
    }
  };

  /*
   * Start completely new conversation.
   */
  const newChat = () => {
    Alert.alert(
      'New Chat',
      'Start a new conversation?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'New Chat',
          onPress: () => {
            setMessages([
              {
                ...welcomeMessage,
                id: `welcome-${Date.now()}`,
              },
            ]);

            setInput('');
            setLoading(false);
          },
        },
      ]
    );
  };

  /*
   * Clear current conversation.
   */
  const clearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Do you want to clear this conversation?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            setInput('');
          },
        },
      ]
    );
  };

  /*
   * Copy AI response.
   */
  const copyResponse = async (text: string) => {
    await Clipboard.setString(text);

    Alert.alert(
      'Copied',
      'AI response copied to clipboard.'
    );
  };

  /*
   * Attachment button.
   * UI only for now.
   */
  const handleAttachment = () => {
    Alert.alert(
      'Attachment',
      'File and image attachment support can be connected next.'
    );
  };

  /*
   * Voice button.
   * UI only for now.
   */
  const handleVoice = () => {
    Alert.alert(
      'Voice Input',
      'Voice input can be connected next using speech recognition.'
    );
  };

  /*
   * Like / dislike buttons.
   */
  const handleFeedback = (type: 'like' | 'dislike') => {
    Alert.alert(
      type === 'like'
        ? 'Thanks for the feedback 👍'
        : 'Thanks for the feedback 👎'
    );
  };

  /*
   * Render individual message.
   */
  const renderMessage = (message: Message) => {
    const isUser = message.sender === 'user';

    return (
      <View
        key={message.id}
        style={[
          styles.messageRow,
          isUser
            ? styles.userRow
            : styles.aiRow,
        ]}
      >
        {!isUser && (
          <View style={styles.smallAiIcon}>
            <Text style={styles.robotEmoji}>
              🤖
            </Text>
          </View>
        )}

        <View
          style={[
            styles.messageColumn,
            isUser
              ? styles.userMessageColumn
              : styles.aiMessageColumn,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isUser
                ? styles.userBubble
                : styles.aiBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isUser
                  ? styles.userMessageText
                  : styles.aiMessageText,
              ]}
            >
              {message.text}
            </Text>
          </View>

          {!isUser && (
            <View style={styles.responseActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  copyResponse(message.text)
                }
              >
                <Text style={styles.actionIcon}>
                  📋
                </Text>

                <Text style={styles.actionText}>
                  Copy
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  handleFeedback('like')
                }
              >
                <Text style={styles.actionIcon}>
                  👍
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  handleFeedback('dislike')
                }
              >
                <Text style={styles.actionIcon}>
                  👎
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  /*
   * Empty state after clearing chat.
   */
  const renderEmptyState = () => {
    return (
      <View style={styles.emptyState}>
        <View style={styles.largeAiIcon}>
          <Text style={styles.largeRobot}>
            🤖
          </Text>
        </View>

        <Text style={styles.emptyTitle}>
          How can I help you?
        </Text>

        <Text style={styles.emptySubtitle}>
          Ask anything about coding, AI, learning,
          projects, writing or everyday questions.
        </Text>

        <View style={styles.emptySuggestions}>
          {suggestions.map((suggestion) => (
            <TouchableOpacity
              key={suggestion}
              style={styles.emptySuggestionButton}
              onPress={() => sendMessage(suggestion)}
              disabled={loading}
            >
              <Text style={styles.emptySuggestionText}>
                {suggestion}
              </Text>

              <Text style={styles.arrow}>
                →
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      {/* ================= HEADER ================= */}

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.aiIcon}>
            <Text style={styles.aiIconText}>
              🤖
            </Text>
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.title}>
              FloodLink AI
            </Text>

            <View style={styles.statusRow}>
              <View style={styles.statusDot} />

              <Text style={styles.statusText}>
                AI Assistant
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          {/* NEW CHAT */}

          <TouchableOpacity
            style={styles.headerButton}
            onPress={newChat}
          >
            <Text style={styles.headerButtonText}>
              ✏️
            </Text>
          </TouchableOpacity>

          {/* CLEAR */}

          <TouchableOpacity
            style={styles.headerButton}
            onPress={clearChat}
          >
            <Text style={styles.headerButtonText}>
              🗑️
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ================= CHAT ================= */}

      <ScrollView
        ref={scrollViewRef}
        style={styles.chat}
        contentContainerStyle={[
          styles.chatContent,
          messages.length === 0 &&
            styles.emptyChatContent,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0
          ? renderEmptyState()
          : messages.map(renderMessage)}

        {/* TYPING INDICATOR */}

        {loading && (
          <View style={styles.messageRow}>
            <View style={styles.smallAiIcon}>
              <Text style={styles.robotEmoji}>
                🤖
              </Text>
            </View>

            <View
              style={[
                styles.messageBubble,
                styles.aiBubble,
                styles.typingBubble,
              ]}
            >
              <View style={styles.typingRow}>
                <ActivityIndicator
                  size="small"
                  color="#1769AA"
                />

                <Text style={styles.typingText}>
                  FloodLink AI is thinking...
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* QUICK QUESTIONS */}

        {messages.length > 0 && !loading && (
          <>
            <Text style={styles.quickTitle}>
              Suggested questions
            </Text>

            <View style={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionButton}
                  onPress={() =>
                    sendMessage(suggestion)
                  }
                  disabled={loading}
                >
                  <Text style={styles.suggestionText}>
                    {suggestion}
                  </Text>

                  <Text style={styles.suggestionArrow}>
                    →
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.disclaimer}>
          FloodLink AI can make mistakes. Check important
          information before relying on it.
        </Text>
      </ScrollView>

      {/* ================= INPUT ================= */}

      <View style={styles.inputContainer}>
        {/* ATTACHMENT */}

        <TouchableOpacity
          style={styles.inputSideButton}
          onPress={handleAttachment}
          disabled={loading}
        >
          <Text style={styles.inputSideIcon}>
            ＋
          </Text>
        </TouchableOpacity>

        {/* TEXT INPUT */}

        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message FloodLink AI..."
          placeholderTextColor="#9AA7B3"
          multiline
          maxLength={4000}
          editable={!loading}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={() => {
            sendMessage();
          }}
        />

        {/* VOICE / SEND */}

        {input.trim().length === 0 ? (
          <TouchableOpacity
            style={styles.inputSideButton}
            onPress={handleVoice}
            disabled={loading}
          >
            <Text style={styles.voiceIcon}>
              🎤
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.sendButton,
              loading &&
                styles.sendButtonDisabled,
            ]}
            onPress={() => sendMessage()}
            disabled={loading}
          >
            <Text style={styles.sendText}>
              ↑
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.bottomText}>
        AI responses are generated automatically.
      </Text>
    </KeyboardAvoidingView>
  );
}

/* ================================================= */
/*                    STYLES                         */
/* ================================================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FC',
  },

  /* ================= HEADER ================= */

  header: {
    height: 78,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF2',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  aiIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EAF3FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  aiIconText: {
    fontSize: 24,
  },

  headerInfo: {
    flex: 1,
  },

  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#123B63',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
    marginRight: 5,
  },

  statusText: {
    fontSize: 10,
    color: '#2E7D32',
    fontWeight: '700',
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerButton: {
    width: 39,
    height: 39,
    borderRadius: 11,
    backgroundColor: '#F5F8FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 7,
    borderWidth: 1,
    borderColor: '#E2E9EF',
  },

  headerButtonText: {
    fontSize: 17,
  },

  /* ================= CHAT ================= */

  chat: {
    flex: 1,
  },

  chatContent: {
    padding: 16,
    paddingBottom: 18,
  },

  emptyChatContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  /* ================= MESSAGES ================= */

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 13,
  },

  aiRow: {
    justifyContent: 'flex-start',
  },

  userRow: {
    justifyContent: 'flex-end',
  },

  smallAiIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EAF3FB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  robotEmoji: {
    fontSize: 17,
  },

  messageColumn: {
    maxWidth: '80%',
  },

  aiMessageColumn: {
    alignItems: 'flex-start',
  },

  userMessageColumn: {
    alignItems: 'flex-end',
  },

  messageBubble: {
    borderRadius: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: {
      width: 0,
      height: 1,
    },
  },

  userBubble: {
    backgroundColor: '#1769AA',
    borderTopRightRadius: 4,
  },

  messageText: {
    fontSize: 14,
    lineHeight: 21,
  },

  aiMessageText: {
    color: '#263746',
  },

  userMessageText: {
    color: '#FFFFFF',
  },

  /* ================= RESPONSE ACTIONS ================= */

  responseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 3,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 13,
    paddingVertical: 3,
  },

  actionIcon: {
    fontSize: 12,
  },

  actionText: {
    fontSize: 10,
    color: '#788896',
    marginLeft: 4,
  },

  /* ================= TYPING ================= */

  typingBubble: {
    paddingVertical: 13,
  },

  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  typingText: {
    marginLeft: 8,
    fontSize: 11,
    color: '#718096',
  },

  /* ================= EMPTY STATE ================= */

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },

  largeAiIcon: {
    width: 70,
    height: 70,
    borderRadius: 23,
    backgroundColor: '#EAF3FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  largeRobot: {
    fontSize: 34,
  },

  emptyTitle: {
    fontSize: 25,
    fontWeight: '900',
    color: '#123B63',
    textAlign: 'center',
  },

  emptySubtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: '#718096',
    textAlign: 'center',
    marginTop: 7,
    paddingHorizontal: 15,
    marginBottom: 20,
  },

  emptySuggestions: {
    width: '100%',
  },

  emptySuggestionButton: {
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5ED',
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  emptySuggestionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#1769AA',
  },

  arrow: {
    fontSize: 18,
    color: '#7C8B98',
  },

  /* ================= QUICK QUESTIONS ================= */

  quickTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#34495E',
    marginTop: 6,
    marginBottom: 9,
  },

  suggestions: {
    marginBottom: 5,
  },

  suggestionButton: {
    minHeight: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5ED',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  suggestionText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#1769AA',
  },

  suggestionArrow: {
    fontSize: 16,
    color: '#7D8C99',
    marginLeft: 8,
  },

  disclaimer: {
    marginTop: 14,
    fontSize: 9,
    lineHeight: 14,
    color: '#8A98A8',
    textAlign: 'center',
  },

  /* ================= INPUT ================= */

  inputContainer: {
    minHeight: 67,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5EBF1',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  inputSideButton: {
    width: 40,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },

  inputSideIcon: {
    fontSize: 27,
    color: '#586A78',
    fontWeight: '400',
  },

  voiceIcon: {
    fontSize: 19,
  },

  input: {
    flex: 1,
    minHeight: 45,
    maxHeight: 115,
    backgroundColor: '#F5F8FC',
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 10,
    fontSize: 14,
    color: '#34495E',
    borderWidth: 1,
    borderColor: '#E1E8EF',
  },

  sendButton: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#1769AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },

  sendButtonDisabled: {
    backgroundColor: '#B8C6D2',
  },

  sendText: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '900',
    marginTop: -4,
  },

  bottomText: {
    backgroundColor: '#FFFFFF',
    color: '#9AA6B2',
    fontSize: 8,
    textAlign: 'center',
    paddingBottom: Platform.OS === 'ios' ? 5 : 7,
  },
});