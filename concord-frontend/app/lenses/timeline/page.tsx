'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useUIStore } from '@/store/ui';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ThumbsUp,
  Heart,
  Laugh,
  Frown,
  Angry,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Image as ImageIcon,
  Video,
  Smile,
  Users,
  Globe,
  Lock,
  Clock,
  Home,
  Tv,
  Store,
  Users2,
  Bookmark,
  CalendarDays,
  Flag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';

interface Post {
  id: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  images?: string[];
  createdAt: string;
  privacy: 'public' | 'friends' | 'private';
  reactions: {
    like: number;
    love: number;
    haha: number;
    sad: number;
    angry: number;
  };
  userReaction?: string;
  comments: number;
  shares: number;
  dtuId?: string;
}

interface Friend {
  id: string;
  name: string;
  avatar?: string;
  mutualFriends: number;
  online: boolean;
}

interface Story {
  id: string;
  author: {
    name: string;
    avatar?: string;
  };
  preview?: string;
  viewed: boolean;
}

const REACTIONS = [
  { id: 'like', icon: ThumbsUp, color: 'text-blue-500', label: 'Like' },
  { id: 'love', icon: Heart, color: 'text-red-500', label: 'Love' },
  { id: 'haha', icon: Laugh, color: 'text-yellow-500', label: 'Haha' },
  { id: 'sad', icon: Frown, color: 'text-yellow-500', label: 'Sad' },
  { id: 'angry', icon: Angry, color: 'text-orange-500', label: 'Angry' },
];

export default function TimelineLensPage() {
  useLensNav('timeline');
  const router = useRouter();
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('timeline');
  const queryClient = useQueryClient();

  const [newPost, setNewPost] = useState('');
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [mediaFilter, setMediaFilter] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [postOptionsMenu, setPostOptionsMenu] = useState<string | null>(null);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const commentImageRefs = useRef<Record<string, HTMLInputElement | null>>({});


  const { data: postsData, isLoading, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['timeline-posts', limit],
    queryFn: () => apiHelpers.dtus.paginated({ limit, offset: 0, tags: 'timeline' }).then(r => r.data),
  });

  const posts =
    postsData?.items?.map((dtu: Record<string, unknown>) => ({
        id: dtu.id,
        author: {
          id: dtu.authorId || 'user',
          name: dtu.authorName || 'Concord User',
        },
        content: dtu.content || dtu.title,
        createdAt: dtu.createdAt,
        privacy: 'public',
        reactions: {
          like: (dtu.reactions as Record<string, number>)?.like || 0,
          love: (dtu.reactions as Record<string, number>)?.love || 0,
          haha: (dtu.reactions as Record<string, number>)?.haha || 0,
          sad: (dtu.reactions as Record<string, number>)?.sad || 0,
          angry: (dtu.reactions as Record<string, number>)?.angry || 0,
        },
        comments: (dtu.comments as number) || 0,
        shares: (dtu.shares as number) || 0,
        dtuId: dtu.id
      })) || [];

  const filteredPosts = mediaFilter
    ? posts.filter((post: Post) => {
        if (mediaFilter === 'video') return post.content?.toLowerCase().includes('video') || post.content?.toLowerCase().includes('[video]');
        if (mediaFilter === 'memories') {
          const postDate = new Date(post.createdAt);
          const now = new Date();
          return postDate.getFullYear() < now.getFullYear();
        }
        if (mediaFilter === 'saved') return post.userReaction === 'love';
        return true;
      })
    : posts;

  const { data: friends, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      try {
        const res = await apiHelpers.personas.list();
        const personas = res.data?.personas || [];
        return personas.map((p: Record<string, unknown>, i: number) => ({
          id: String(p.id || i),
          name: String(p.name || `User ${i + 1}`),
          mutualFriends: (p.mutualFriends as number) || 0,
          online: i % 2 === 0,
        })) as Friend[];
      } catch {
        return [] as Friend[];
      }
    },
  });

  const { data: stories, isError: isError3, error: error3, refetch: refetch3,} = useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      try {
        const res = await apiHelpers.dtus.paginated({ limit: 5, tags: 'story' });
        const dtus = res.data?.dtus || [];
        const storyItems: Story[] = [
          { id: 'yours', author: { name: 'Your Story' }, viewed: false },
          ...dtus.map((d: Record<string, unknown>) => ({
            id: String(d.id),
            author: { name: String(d.authorName || 'User') },
            viewed: false,
          })),
        ];
        return storyItems;
      } catch {
        return [{ id: 'yours', author: { name: 'Your Story' }, viewed: false }] as Story[];
      }
    },
  });

  const postMutation = useMutation({
    mutationFn: (content: string) => apiHelpers.dtus.create({ content, tags: ['timeline'] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-posts'] });
      setNewPost('');
      setPostContent('');
      setShowPostModal(false);
    },
    onError: (err) => {
      console.error('Failed to create post:', err instanceof Error ? err.message : err);
    },
  });

  const handleCreatePost = () => {
    if (!postContent.trim() || postMutation.isPending) return;
    postMutation.mutate(postContent.trim());
  };

  const reactMutation = useMutation({
    mutationFn: ({ postId, reaction }: { postId: string; reaction: string }) => apiHelpers.dtus.update(postId, { reaction }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timeline-posts'] }),
    onError: () => {
      useUIStore.getState().addToast({ type: 'error', message: 'Operation failed. Please try again.' });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (postId: string) => {
      await navigator.clipboard.writeText(`${window.location.origin}/lenses/timeline?post=${postId}`);
      useUIStore.getState().addToast({ type: 'success', message: 'Link copied' });
    },
    onError: () => {
      useUIStore.getState().addToast({ type: 'error', message: 'Operation failed. Please try again.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => apiHelpers.dtus.delete(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-posts'] });
      useUIStore.getState().addToast({ type: 'success', message: 'Post deleted' });
    },
    onError: () => {
      useUIStore.getState().addToast({ type: 'error', message: 'Failed to delete post' });
    },
  });

  const friendAction = useMutation({
    mutationFn: ({ friendId, action: _action }: { friendId: string; action: string }) => apiHelpers.social.follow(friendId),
    onSuccess: (_, { action }) => useUIStore.getState().addToast({ type: 'success', message: action === 'confirm' ? 'Friend request accepted' : 'Request removed' }),
    onError: () => {
      useUIStore.getState().addToast({ type: 'error', message: 'Operation failed. Please try again.' });
    },
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const getTotalReactions = (reactions: Post['reactions']) => {
    return Object.values(reactions).reduce((a, b) => a + b, 0);
  };

  const getTopReactions = (reactions: Post['reactions']) => {
    return Object.entries(reactions)
      .filter(([_, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type]) => REACTIONS.find(r => r.id === type));
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="timeline" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message} onRetry={() => { refetch(); refetch2(); refetch3(); }} />
      </div>
    );
  }
  return (
    <div data-lens-theme="timeline" className="min-h-full bg-[#18191a]">
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="bg-[#242526] rounded-lg p-3 flex items-center justify-between text-sm">
          <span className="text-gray-300">Timeline defaults to 30 posts for speed.</span>
          <Link href="/lenses/global" className="text-blue-400 hover:text-blue-300">View all in Global</Link>
        </div>
      </div>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#242526] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl">📅</span>
            <span className="text-2xl font-bold text-blue-500">Timeline Lens</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="p-2 bg-[#3a3b3c] rounded-full hover:bg-[#4a4b4c] transition-colors">
              <Home className="w-5 h-5 text-white" />
            </button>
            <button onClick={() => setMediaFilter(mediaFilter === 'video' ? null : 'video')} className={cn("p-2 bg-[#3a3b3c] rounded-full hover:bg-[#4a4b4c] transition-colors", mediaFilter === 'video' && "ring-2 ring-blue-500")}>
              <Tv className={cn("w-5 h-5", mediaFilter === 'video' ? "text-blue-500" : "text-gray-400")} />
            </button>
            <button onClick={() => router.push('/lenses/marketplace')} className="p-2 bg-[#3a3b3c] rounded-full hover:bg-[#4a4b4c] transition-colors">
              <Store className="w-5 h-5 text-gray-400" />
            </button>
            <button onClick={() => router.push('/lenses/forum')} className="p-2 bg-[#3a3b3c] rounded-full hover:bg-[#4a4b4c] transition-colors">
              <Users2 className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 flex gap-4">
        {/* Left Sidebar */}
        <aside className="w-64 hidden lg:block space-y-1">
          {[
            { icon: Users, label: 'Friends', action: () => router.push('/lenses/collab') },
            { icon: Users2, label: 'Groups', action: () => router.push('/lenses/forum') },
            { icon: Tv, label: 'Watch', action: () => setMediaFilter(mediaFilter === 'video' ? null : 'video') },
            { icon: Clock, label: 'Memories', action: () => setMediaFilter(mediaFilter === 'memories' ? null : 'memories') },
            { icon: Bookmark, label: 'Saved', action: () => setMediaFilter(mediaFilter === 'saved' ? null : 'saved') },
            { icon: CalendarDays, label: 'Events', action: () => router.push('/lenses/calendar') },
            { icon: Flag, label: 'Pages', action: () => router.push('/lenses/forum') },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              className={cn(
                "w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#3a3b3c] transition-colors",
                mediaFilter === item.label.toLowerCase() && "bg-[#3a3b3c]"
              )}
            >
              <div className="w-9 h-9 rounded-full bg-[#3a3b3c] flex items-center justify-center">
                <item.icon className={cn("w-5 h-5", mediaFilter === item.label.toLowerCase() ? "text-blue-400" : "text-blue-500")} />
              </div>
              <span className="text-white text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Main Feed */}
        <main className="flex-1 max-w-xl mx-auto space-y-4">
          {/* Stories */}
          <div className="bg-[#242526] rounded-lg p-4">
            <div className="flex gap-2 flex-wrap no-scrollbar">
              {stories?.map((story, i) => (
                <button
                  key={story.id}
                  onClick={() => i === 0 ? setShowPostModal(true) : setViewingStory(story)}
                  className={cn(
                    'flex-shrink-0 w-28 h-48 rounded-xl overflow-hidden relative',
                    i === 0 ? 'bg-[#3a3b3c]' : 'bg-gradient-to-br from-blue-500 to-purple-500'
                  )}
                >
                  {i === 0 ? (
                    <div className="h-full flex flex-col items-center justify-end pb-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center border-4 border-[#242526] -mt-5">
                        <span className="text-white text-2xl">+</span>
                      </div>
                      <span className="text-white text-xs mt-2">Create story</span>
                    </div>
                  ) : (
                    <>
                      <div className={cn(
                        'absolute top-2 left-2 w-10 h-10 rounded-full border-4',
                        story.viewed ? 'border-gray-600' : 'border-blue-500'
                      )}>
                        <div className="w-full h-full rounded-full bg-gray-700" />
                      </div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <span className="text-white text-xs font-medium">{story.author.name}</span>
                      </div>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Active Filter Banner */}
          {mediaFilter && (
            <div className="bg-[#242526] rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-blue-400">Filtering: <span className="font-medium capitalize">{mediaFilter}</span></span>
              <button onClick={() => setMediaFilter(null)} className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-[#3a3b3c]">Clear filter</button>
            </div>
          )}

          {/* Create Post */}
          <div className="bg-[#242526] rounded-lg p-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex-shrink-0" />
              <input
                type="text"
                value={newPost}
                onChange={e => setNewPost(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newPost.trim()) {
                    postMutation.mutate(newPost.trim());
                  }
                }}
                placeholder="What's on your mind?"
                className="flex-1 px-4 py-2.5 bg-[#3a3b3c] rounded-full text-left text-gray-300 placeholder-gray-400 hover:bg-[#4a4b4c] focus:bg-[#4a4b4c] outline-none transition-colors"
              />
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700">
              <button onClick={() => setShowPostModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[#3a3b3c] transition-colors">
                <Video className="w-5 h-5 text-red-500" />
                <span className="text-gray-300 text-sm">Live video</span>
              </button>
              <button onClick={() => setShowPostModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[#3a3b3c] transition-colors">
                <ImageIcon className="w-5 h-5 text-green-500" />
                <span className="text-gray-300 text-sm">Photo/video</span>
              </button>
              <button onClick={() => setShowPostModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[#3a3b3c] transition-colors">
                <Smile className="w-5 h-5 text-yellow-500" />
                <span className="text-gray-300 text-sm">Feeling</span>
              </button>
            </div>
          </div>

          {/* Posts */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[#242526] rounded-lg p-4 animate-pulse">
                  <div className="flex gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#3a3b3c]" />
                    <div className="space-y-2">
                      <div className="h-4 bg-[#3a3b3c] rounded w-32" />
                      <div className="h-3 bg-[#3a3b3c] rounded w-20" />
                    </div>
                  </div>
                  <div className="h-20 bg-[#3a3b3c] rounded" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="bg-[#242526] rounded-lg p-3 flex items-center justify-between text-xs text-gray-400">
                <span>Showing {filteredPosts.length} of {postsData?.total || posts.length} timeline DTUs{mediaFilter ? ` (filtered: ${mediaFilter})` : ''}</span>
                <button
                  className="px-3 py-1.5 rounded bg-[#3a3b3c] text-white disabled:opacity-50"
                  disabled={posts.length >= Number(postsData?.total || 0)}
                  onClick={() => setLimit((v) => v + 30)}
                >
                  Load more
                </button>
              </div>
            {filteredPosts?.map((post: Post) => (
              <article key={post.id} className="bg-[#242526] rounded-lg">
                {/* Post Header */}
                <div className="p-4 pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                      <div>
                        <h3 className="font-semibold text-white hover:underline cursor-pointer">
                          {post.author.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <span>{formatTime(post.createdAt)}</span>
                          <span>·</span>
                          {post.privacy === 'public' ? (
                            <Globe className="w-3 h-3" />
                          ) : post.privacy === 'friends' ? (
                            <Users className="w-3 h-3" />
                          ) : (
                            <Lock className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <button onClick={() => setPostOptionsMenu(postOptionsMenu === post.id ? null : post.id)} className="p-2 rounded-full hover:bg-[#3a3b3c] transition-colors">
                        <MoreHorizontal className="w-5 h-5 text-gray-400" />
                      </button>
                      {postOptionsMenu === post.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-[#242526] border border-gray-700 rounded-lg shadow-xl z-10 py-1">
                          <button
                            onClick={() => { setPostContent(post.content); setShowPostModal(true); setPostOptionsMenu(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#3a3b3c] transition-colors"
                          >
                            Edit post
                          </button>
                          <button
                            onClick={() => { deleteMutation.mutate(post.id); setPostOptionsMenu(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#3a3b3c] transition-colors"
                          >
                            Delete post
                          </button>
                          <button
                            onClick={() => { shareMutation.mutate(post.id); setPostOptionsMenu(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#3a3b3c] transition-colors"
                          >
                            Share post
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <div className="px-4 py-3">
                  <p className="text-white whitespace-pre-wrap">{post.content}</p>
                </div>

                {/* Reactions Bar */}
                <div className="px-4 py-2 flex items-center justify-between text-gray-400 text-sm border-b border-gray-700">
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-1">
                      {getTopReactions(post.reactions).map(reaction => reaction && (
                        <div
                          key={reaction.id}
                          className={cn('w-5 h-5 rounded-full bg-[#3a3b3c] flex items-center justify-center', reaction.color)}
                        >
                          <reaction.icon className="w-3 h-3" />
                        </div>
                      ))}
                    </div>
                    <span className="ml-1">{getTotalReactions(post.reactions)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>{post.comments} comments</span>
                    <span>{post.shares} shares</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-4 py-1 flex items-center">
                  <div
                    className="relative flex-1"
                    onMouseEnter={() => setShowReactions(post.id)}
                    onMouseLeave={() => setShowReactions(null)}
                  >
                    <button onClick={() => reactMutation.mutate({ postId: post.id, reaction: 'like' })} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-[#3a3b3c] transition-colors">
                      <ThumbsUp className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-400 font-medium">Like</span>
                    </button>

                    {/* Reactions Popup */}
                    <AnimatePresence>
                      {showReactions === post.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.9 }}
                          className="absolute bottom-full left-0 mb-2 flex gap-1 p-2 bg-[#242526] rounded-full shadow-xl border border-gray-700"
                        >
                          {REACTIONS.map(reaction => (
                            <button
                              key={reaction.id}
                              onClick={() => { reactMutation.mutate({ postId: post.id, reaction: reaction.id }); setShowReactions(null); }}
                              className="p-2 rounded-full hover:bg-[#3a3b3c] hover:scale-125 transition-all"
                              title={reaction.label}
                            >
                              <reaction.icon className={cn('w-6 h-6', reaction.color)} />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button onClick={() => setExpandedComments(prev => { const next = new Set(prev); if (next.has(post.id)) next.delete(post.id); else next.add(post.id); return next; })} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-[#3a3b3c] transition-colors">
                    <MessageCircle className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-400 font-medium">Comment</span>
                  </button>

                  <button onClick={() => shareMutation.mutate(post.id)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-[#3a3b3c] transition-colors">
                    <Share2 className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-400 font-medium">Share</span>
                  </button>
                </div>

                {/* Comment Input */}
                {expandedComments.has(post.id) && (
                <div className="px-4 py-3 flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex-shrink-0" />
                  <div className="flex-1 relative">
                    <div className="flex items-center bg-[#3a3b3c] rounded-full px-4">
                      <input
                        id={`comment-input-${post.id}`}
                        type="text"
                        placeholder="Write a comment..."
                        className="flex-1 py-2 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
                      />
                      <div className="flex items-center gap-1">
                        <button onClick={() => setShowEmojiPicker(showEmojiPicker === post.id ? null : post.id)} className="p-1 text-gray-400 hover:text-gray-300">
                          <Smile className="w-5 h-5" />
                        </button>
                        <button onClick={() => commentImageRefs.current[post.id]?.click()} className="p-1 text-gray-400 hover:text-gray-300">
                          <ImageIcon className="w-5 h-5" />
                        </button>
                        <input
                          ref={(el) => { commentImageRefs.current[post.id] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              useUIStore.getState().addToast({ type: 'success', message: `Image "${file.name}" attached` });
                              e.target.value = '';
                            }
                          }}
                        />
                      </div>
                    </div>
                    {showEmojiPicker === post.id && (
                      <div className="absolute bottom-full mb-2 right-0 bg-[#242526] border border-gray-700 rounded-lg shadow-xl p-2 flex gap-1 z-10">
                        {['😀', '😂', '❤️', '👍', '🔥', '😮', '😢', '🎉'].map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => {
                              const input = document.getElementById(`comment-input-${post.id}`) as HTMLInputElement;
                              if (input) {
                                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                                nativeInputValueSetter?.call(input, input.value + emoji);
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.focus();
                              }
                              setShowEmojiPicker(null);
                            }}
                            className="p-1.5 text-lg hover:bg-[#3a3b3c] rounded transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                )}
              </article>
            ))}
            </>
          )}
        </main>

        {/* Right Sidebar */}
        <aside className="w-72 hidden xl:block space-y-4">
          {/* Friend Requests */}
          <div className="bg-[#242526] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Friend Requests</h3>
              <button onClick={() => router.push('/lenses/collab')} className="text-blue-500 text-sm hover:underline">See all</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-500" />
              <div className="flex-1">
                <p className="font-medium text-white text-sm">New User</p>
                <p className="text-xs text-gray-400">5 mutual friends</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => friendAction.mutate({ friendId: 'new-user', action: 'confirm' })} className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-md hover:bg-blue-600">
                    Confirm
                  </button>
                  <button onClick={() => friendAction.mutate({ friendId: 'new-user', action: 'delete' })} className="px-3 py-1.5 bg-[#3a3b3c] text-white text-xs font-medium rounded-md hover:bg-[#4a4b4c]">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className="bg-[#242526] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Contacts</h3>
            </div>
            <div className="space-y-1">
              {friends?.map((friend: Friend) => (
                <button
                  key={friend.id}
                  onClick={() => router.push('/lenses/chat')}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#3a3b3c] transition-colors"
                >
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-red-500" />
                    {friend.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#242526]" />
                    )}
                  </div>
                  <span className="text-white text-sm">{friend.name}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {showPostModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPostModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#242526] border border-gray-700 rounded-xl w-full max-w-lg p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Create Post</h3>
                <button onClick={() => setShowPostModal(false)} className="text-gray-400 hover:text-white">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex-shrink-0" />
                <textarea
                  value={postContent}
                  onChange={e => setPostContent(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={4}
                  autoFocus
                  className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none resize-none text-lg"
                />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                <div className="flex items-center gap-2">
                  <button onClick={() => setPostContent(prev => prev + ' [Photo]')} className="p-2 rounded-lg hover:bg-[#3a3b3c] text-green-500 transition-colors">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => setPostContent(prev => prev + ' :)')} className="p-2 rounded-lg hover:bg-[#3a3b3c] text-yellow-500 transition-colors">
                    <Smile className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={handleCreatePost}
                  disabled={!postContent.trim() || postMutation.isPending}
                  className={cn(
                    'px-6 py-2 rounded-lg font-medium text-sm transition-colors',
                    postContent.trim() && !postMutation.isPending
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  )}
                >
                  {postMutation.isPending ? 'Posting...' : 'Post'}
                </button>

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="timeline"
          data={realtimeData}
          isLive={isLive}
          lastUpdated={lastUpdated}
          insights={realtimeInsights}
          compact
        />
      )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story Viewing Modal */}
      <AnimatePresence>
        {viewingStory && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setViewingStory(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl w-full max-w-sm h-[70vh] relative flex flex-col items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setViewingStory(null)} className="absolute top-4 right-4 text-white/80 hover:text-white">
                <MoreHorizontal className="w-6 h-6" />
              </button>
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20" />
                <span className="text-white font-medium text-sm">{viewingStory.author.name}</span>
              </div>
              {/* Progress bar */}
              <div className="absolute top-1 left-2 right-2 h-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 5, ease: 'linear' }}
                  onAnimationComplete={() => setViewingStory(null)}
                  className="h-full bg-white rounded-full"
                />
              </div>
              <p className="text-white text-center px-8 text-lg">
                {viewingStory.preview || `${viewingStory.author.name} shared a story`}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
