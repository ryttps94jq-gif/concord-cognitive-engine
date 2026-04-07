// Concord Mobile — Chat Screen
// Primary interface. Lens-aware. Forge-capable.

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMeshStatus } from '../../hooks/useMeshStatus';
import { useIdentity } from '../../hooks/useIdentity';
import { ConnectionIndicator } from '../components/ConnectionIndicator';

// Base URL for the Concord backend. Override with EXPO_PUBLIC_API_URL in .env.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5050';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  routedTo?: 'local' | 'server';
}

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { connectionState } = useMeshStatus();
  const { isInitialized } = useIdentity();

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsGenerating(true);

    try {
      let replyContent: string;
      let routedTo: 'local' | 'server';

      if (connectionState === 'offline') {
        // Offline: brain router would handle local inference. Not yet wired.
        replyContent = '[Offline — local inference not yet available on this device]';
        routedTo = 'local';
      } else {
        // Online: call the backend chat API, matching the frontend pattern.
        routedTo = 'server';
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage.content }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        // Accept any of the reply field names the server may use.
        replyContent =
          data.reply ??
          data.answer ??
          data.content ??
          data.text ??
          data.response ??
          (data.error ? `Error: ${data.error}` : 'No response from server.');
      }

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_resp`,
        role: 'assistant',
        content: replyContent,
        timestamp: Date.now(),
        routedTo,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: `Failed to get response: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        routedTo: 'server',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  }, [inputText, isGenerating, connectionState]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <View style={[
      styles.messageBubble,
      item.role === 'user' ? styles.userMessage : styles.assistantMessage,
    ]}>
      <Text style={styles.messageText}>{item.content}</Text>
      {item.routedTo && (
        <Text style={styles.routeIndicator}>
          {item.routedTo === 'local' ? 'Local' : 'Server'}
        </Text>
      )}
    </View>
  ), []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Concord</Text>
        <ConnectionIndicator state={connectionState} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Welcome to Concord</Text>
            <Text style={styles.emptySubtitle}>
              {isInitialized
                ? 'Start a conversation. Your identity is established.'
                : 'Initializing device identity...'}
            </Text>
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Message..."
          placeholderTextColor="#666"
          multiline
          maxLength={10000}
          editable={!isGenerating}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isGenerating) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim() || isGenerating}
        >
          <Text style={styles.sendButtonText}>
            {isGenerating ? '...' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  headerTitle: {
    color: '#00d4ff',
    fontSize: 20,
    fontWeight: '700',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#1a3a5c',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a1a2e',
  },
  messageText: {
    color: '#e0e0e0',
    fontSize: 16,
    lineHeight: 22,
  },
  routeIndicator: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    color: '#e0e0e0',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
  },
  input: {
    flex: 1,
    backgroundColor: '#14141f',
    color: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  sendButton: {
    backgroundColor: '#00d4ff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#0a0a0f',
    fontSize: 16,
    fontWeight: '600',
  },
});
