import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, MessageCircle, Plus, Send, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface ConversationData {
  id: string;
  name: string | null;
  isGroup: boolean | null;
  createdBy: string | null;
  createdAt: string | null;
  participants: { id: string; fullName: string; username: string; avatar: string | null }[];
  lastMessage: { id: string; senderId: string; message: string; createdAt: string | null } | null;
}

interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  message: string;
  createdAt: string | null;
}

export default function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: convsLoading } = useQuery<ConversationData[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 3000,
  });

  const { data: friends = [] } = useQuery<any[]>({
    queryKey: ["/api/friends"],
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<MessageData[]>({
    queryKey: ["/api/conversations", activeConversation, "messages"],
    enabled: !!activeConversation,
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId: string; message: string }) => {
      await apiRequest("POST", `/api/conversations/${conversationId}/messages`, { message });
    },
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConversation, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async (data: { participantIds: string[]; name?: string; isGroup?: boolean }) => {
      const res = await apiRequest("POST", "/api/conversations", data);
      return await res.json();
    },
    onSuccess: (data: ConversationData) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setActiveConversation(data.id);
      setNewChatOpen(false);
      setNewGroupOpen(false);
      setGroupName("");
      setSelectedFriends([]);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create conversation", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const activeConv = conversations.find((c) => c.id === activeConversation);

  function getConversationName(conv: ConversationData) {
    if (conv.isGroup && conv.name) return conv.name;
    const other = conv.participants.find((p) => p.id !== user?.id);
    return other?.fullName || "Chat";
  }

  function getConversationAvatar(conv: ConversationData) {
    if (conv.isGroup) return null;
    const other = conv.participants.find((p) => p.id !== user?.id);
    return other?.avatar || null;
  }

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConversation || !messageInput.trim()) return;
    sendMessageMutation.mutate({ conversationId: activeConversation, message: messageInput.trim() });
  }

  function handleStartChat(friendId: string) {
    createConversationMutation.mutate({ participantIds: [friendId] });
  }

  function handleCreateGroup() {
    if (selectedFriends.length < 2) {
      toast({ title: "Select at least 2 friends", variant: "destructive" });
      return;
    }
    if (!groupName.trim()) {
      toast({ title: "Enter a group name", variant: "destructive" });
      return;
    }
    createConversationMutation.mutate({
      participantIds: selectedFriends,
      name: groupName.trim(),
      isGroup: true,
    });
  }

  function toggleFriendSelection(friendId: string) {
    setSelectedFriends((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  }

  const friendUsers = friends.map((f: any) => f.user);

  if (convsLoading) {
    return (
      <div className="min-h-screen bg-background p-4 pb-28">
        <div className="max-w-lg mx-auto space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
      </div>
    );
  }

  if (activeConversation && activeConv) {
    const senderMap = new Map<string, { fullName: string; avatar: string | null }>();
    activeConv.participants.forEach((p) => {
      senderMap.set(p.id, { fullName: p.fullName, avatar: p.avatar });
    });

    return (
      <div className="flex flex-col h-screen pb-24 bg-background" data-testid="chat-view">
        <div className="flex items-center gap-3 p-3 border-b sticky top-0 bg-background z-40">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveConversation(null)}
            data-testid="button-back-chat"
          >
            <ArrowLeft size={20} />
          </Button>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={getConversationAvatar(activeConv) || undefined} />
            <AvatarFallback className="text-xs">{getInitials(getConversationName(activeConv))}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate" data-testid="text-chat-name">
              {getConversationName(activeConv)}
            </p>
            {activeConv.isGroup && (
              <p className="text-xs text-muted-foreground">{activeConv.participants.length} members</p>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3 max-w-lg mx-auto pb-4">
            {messagesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-40 ml-auto" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageCircle size={40} className="text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.senderId === user?.id;
                const sender = senderMap.get(msg.senderId);
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isOwn ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${msg.id}`}
                  >
                    {!isOwn && activeConv.isGroup && (
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={sender?.avatar || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(sender?.fullName || "?")}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}
                    >
                      {!isOwn && activeConv.isGroup && (
                        <p className="text-[10px] font-medium mb-0.5 opacity-70">
                          {sender?.fullName || "Unknown"}
                        </p>
                      )}
                      <p className="text-sm break-words">{msg.message}</p>
                      <p
                        className={`text-[10px] mt-0.5 ${
                          isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t bg-background sticky bottom-0"
          data-testid="form-send-message"
        >
          <div className="max-w-lg mx-auto flex items-center gap-2">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              data-testid="input-message"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!messageInput.trim() || sendMessageMutation.isPending}
              data-testid="button-send-message"
            >
              <Send size={18} />
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 pb-28" data-testid="chat-list">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-semibold" data-testid="text-chat-title">Messages</h1>
          <div className="flex items-center gap-2">
            <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-new-chat">
                  <Plus size={16} className="mr-1" />
                  Chat
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Chat</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-80">
                  <div className="space-y-2">
                    {friendUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Add friends to start chatting
                      </p>
                    ) : (
                      friendUsers.map((friend: any) => (
                        <button
                          key={friend.id}
                          className="flex items-center gap-3 w-full p-2 rounded-md hover-elevate"
                          onClick={() => handleStartChat(friend.id)}
                          disabled={createConversationMutation.isPending}
                          data-testid={`button-start-chat-${friend.id}`}
                        >
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage src={friend.avatar || undefined} />
                            <AvatarFallback className="text-xs">{getInitials(friend.fullName)}</AvatarFallback>
                          </Avatar>
                          <div className="text-left min-w-0">
                            <p className="text-sm font-medium truncate">{friend.fullName}</p>
                            <p className="text-xs text-muted-foreground truncate">@{friend.username}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-new-group">
                  <Users size={16} className="mr-1" />
                  Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Group Chat</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    data-testid="input-group-name"
                  />
                  <ScrollArea className="max-h-56">
                    <div className="space-y-2">
                      {friendUsers.map((friend: any) => (
                        <label
                          key={friend.id}
                          className="flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                          data-testid={`label-select-friend-${friend.id}`}
                        >
                          <Checkbox
                            checked={selectedFriends.includes(friend.id)}
                            onCheckedChange={() => toggleFriendSelection(friend.id)}
                            data-testid={`checkbox-friend-${friend.id}`}
                          />
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={friend.avatar || undefined} />
                            <AvatarFallback className="text-xs">{getInitials(friend.fullName)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">{friend.fullName}</span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                  <Button
                    className="w-full"
                    onClick={handleCreateGroup}
                    disabled={createConversationMutation.isPending || selectedFriends.length < 2 || !groupName.trim()}
                    data-testid="button-create-group"
                  >
                    Create Group ({selectedFriends.length} selected)
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {conversations.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageCircle size={40} className="text-muted-foreground mb-3" />
              <h3 className="font-semibold text-base mb-1" data-testid="text-no-conversations">
                No conversations yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Start a chat with one of your friends
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => {
              const convName = getConversationName(conv);
              const convAvatar = getConversationAvatar(conv);
              const lastMsg = conv.lastMessage;
              let preview = "";
              if (lastMsg) {
                const senderIsMe = lastMsg.senderId === user?.id;
                const senderName = senderIsMe
                  ? "You"
                  : conv.participants.find((p) => p.id === lastMsg.senderId)?.fullName || "Someone";
                preview = conv.isGroup
                  ? `${senderName}: ${lastMsg.message}`
                  : senderIsMe
                    ? `You: ${lastMsg.message}`
                    : lastMsg.message;
              }

              return (
                <button
                  key={conv.id}
                  className="w-full flex items-center gap-3 p-3 rounded-md hover-elevate text-left"
                  onClick={() => setActiveConversation(conv.id)}
                  data-testid={`conversation-${conv.id}`}
                >
                  <Avatar className="h-11 w-11 shrink-0">
                    {conv.isGroup ? (
                      <AvatarFallback>
                        <Users size={18} />
                      </AvatarFallback>
                    ) : (
                      <>
                        <AvatarImage src={convAvatar || undefined} />
                        <AvatarFallback className="text-sm">{getInitials(convName)}</AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{convName}</span>
                      {lastMsg?.createdAt && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatTime(lastMsg.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground truncate flex-1">
                        {preview || "No messages yet"}
                      </p>
                      {conv.isGroup && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {conv.participants.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
