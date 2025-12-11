import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  MessageSquare,
  Eye,
  Pin,
  Lock,
  Clock,
  ThumbsUp,
  Loader2,
  Users,
  Flag,
  Share2,
  Reply,
  ChevronUp,
  ChevronDown,
  LogIn,
  Send,
  MoreHorizontal,
  Bookmark,
  AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface Discussion {
  id: string;
  category_id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_address: string;
  is_pinned: boolean;
  is_locked: boolean;
  views_count: number;
  replies_count: number;
  tags: string[];
  created_at: string;
  last_activity_at: string;
  category?: Category;
  upvotes: number;
}

interface Reply {
  id: string;
  discussion_id: string;
  content: string;
  author_id: string;
  author_name: string;
  author_address: string;
  parent_reply_id: string | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  is_hidden: boolean;
  replies?: Reply[];
}

const ForumTopic: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [nestedReplyContent, setNestedReplyContent] = useState('');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down' | null>>({});
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingId, setReportingId] = useState<{ type: 'discussion' | 'reply'; id: string } | null>(null);

  // Auth-gated action wrapper
  const requireAuth = (action: () => void) => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    action();
  };

  // Fetch discussion
  const fetchDiscussion = useCallback(async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('forum_discussions')
      .select(`
        *,
        category:forum_categories(id, name, icon, color)
      `)
      .eq('id', id)
      .single();

    if (!error && data) {
      setDiscussion(data);
      // Increment view count
      await supabase
        .from('forum_discussions')
        .update({ views_count: (data.views_count || 0) + 1 })
        .eq('id', id);
    }
  }, [id]);

  // Fetch replies
  const fetchReplies = useCallback(async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('forum_replies')
      .select('*')
      .eq('discussion_id', id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true });

    if (!error && data) {
      // Organize into nested structure
      const replyMap = new Map<string, Reply>();
      const rootReplies: Reply[] = [];

      data.forEach(reply => {
        replyMap.set(reply.id, { ...reply, replies: [] });
      });

      data.forEach(reply => {
        const replyWithChildren = replyMap.get(reply.id)!;
        if (reply.parent_reply_id) {
          const parent = replyMap.get(reply.parent_reply_id);
          if (parent) {
            parent.replies = parent.replies || [];
            parent.replies.push(replyWithChildren);
          }
        } else {
          rootReplies.push(replyWithChildren);
        }
      });

      setReplies(rootReplies);
    }
  }, [id]);

  // Fetch user's votes
  const fetchUserVotes = useCallback(async () => {
    if (!user || !id) return;

    const { data } = await supabase
      .from('forum_votes')
      .select('target_id, vote_type')
      .eq('user_id', user.id)
      .eq('discussion_id', id);

    if (data) {
      const votes: Record<string, 'up' | 'down' | null> = {};
      data.forEach(v => {
        votes[v.target_id] = v.vote_type as 'up' | 'down';
      });
      setUserVotes(votes);
    }
  }, [user, id]);

  // Check if bookmarked
  const checkBookmark = useCallback(async () => {
    if (!user || !id) return;

    const { data } = await supabase
      .from('forum_bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('discussion_id', id)
      .single();

    setIsBookmarked(!!data);
  }, [user, id]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchDiscussion(),
        fetchReplies(),
        fetchUserVotes(),
        checkBookmark(),
      ]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchDiscussion, fetchReplies, fetchUserVotes, checkBookmark]);

  // Submit reply
  const handleSubmitReply = async (parentId: string | null = null) => {
    const content = parentId ? nestedReplyContent : replyContent;
    if (!user || !content.trim() || !id) return;

    setIsSubmitting(true);

    const { error } = await supabase
      .from('forum_replies')
      .insert({
        discussion_id: id,
        content: content.trim(),
        author_id: user.id,
        author_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous',
        author_address: user.user_metadata?.wallet_address || null,
        parent_reply_id: parentId,
      });

    if (!error) {
      // Update reply count
      await supabase
        .from('forum_discussions')
        .update({
          replies_count: (discussion?.replies_count || 0) + 1,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (parentId) {
        setNestedReplyContent('');
        setReplyingTo(null);
      } else {
        setReplyContent('');
      }
      fetchReplies();
      fetchDiscussion();
    }

    setIsSubmitting(false);
  };

  // Vote on reply
  const handleVote = async (replyId: string, voteType: 'up' | 'down') => {
    if (!user || !id) return;

    const currentVote = userVotes[replyId];

    if (currentVote === voteType) {
      // Remove vote
      await supabase
        .from('forum_votes')
        .delete()
        .eq('user_id', user.id)
        .eq('target_id', replyId);

      setUserVotes(prev => ({ ...prev, [replyId]: null }));

      // Update reply vote count
      const field = voteType === 'up' ? 'upvotes' : 'downvotes';
      await supabase.rpc('decrement_vote', { reply_id: replyId, vote_field: field });
    } else {
      // Upsert vote
      await supabase
        .from('forum_votes')
        .upsert({
          user_id: user.id,
          discussion_id: id,
          target_id: replyId,
          target_type: 'reply',
          vote_type: voteType,
        }, { onConflict: 'user_id,target_id' });

      setUserVotes(prev => ({ ...prev, [replyId]: voteType }));

      // Update vote counts
      if (currentVote) {
        const oldField = currentVote === 'up' ? 'upvotes' : 'downvotes';
        await supabase.rpc('decrement_vote', { reply_id: replyId, vote_field: oldField });
      }
      const newField = voteType === 'up' ? 'upvotes' : 'downvotes';
      await supabase.rpc('increment_vote', { reply_id: replyId, vote_field: newField });
    }

    fetchReplies();
  };

  // Toggle bookmark
  const handleBookmark = async () => {
    if (!user || !id) return;

    if (isBookmarked) {
      await supabase
        .from('forum_bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('discussion_id', id);
    } else {
      await supabase
        .from('forum_bookmarks')
        .insert({
          user_id: user.id,
          discussion_id: id,
        });
    }

    setIsBookmarked(!isBookmarked);
  };

  // Copy share link
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    // You could add a toast notification here
  };

  // Report content
  const handleReport = async (reason: string) => {
    if (!user || !reportingId) return;

    await supabase
      .from('forum_reports')
      .insert({
        user_id: user.id,
        target_type: reportingId.type,
        target_id: reportingId.id,
        reason,
      });

    setShowReportModal(false);
    setReportingId(null);
  };

  // Render a single reply
  const renderReply = (reply: Reply, depth = 0) => {
    const vote = userVotes[reply.id];
    const netVotes = (reply.upvotes || 0) - (reply.downvotes || 0);

    return (
      <div key={reply.id} className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-800 pl-4' : ''}`}>
        <div className="bg-gray-900/50 rounded-lg p-4 mb-3">
          <div className="flex items-start gap-3">
            {/* Vote buttons */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => requireAuth(() => handleVote(reply.id, 'up'))}
                className={`p-1 rounded hover:bg-gray-800 transition-colors ${
                  vote === 'up' ? 'text-green-500' : 'text-gray-500'
                }`}
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <span className={`text-sm font-semibold ${
                netVotes > 0 ? 'text-green-400' : netVotes < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {netVotes}
              </span>
              <button
                onClick={() => requireAuth(() => handleVote(reply.id, 'down'))}
                className={`p-1 rounded hover:bg-gray-800 transition-colors ${
                  vote === 'down' ? 'text-red-500' : 'text-gray-500'
                }`}
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-yellow-500 flex items-center justify-center text-white text-sm font-bold">
                  {reply.author_name.charAt(0).toUpperCase()}
                </div>
                <span className="text-white font-medium">{reply.author_name}</span>
                <span className="text-gray-500 text-sm">
                  {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                </span>
              </div>

              <p className="text-gray-300 whitespace-pre-wrap">{reply.content}</p>

              <div className="flex items-center gap-4 mt-3">
                <button
                  onClick={() => requireAuth(() => {
                    setReplyingTo(replyingTo === reply.id ? null : reply.id);
                    setNestedReplyContent('');
                  })}
                  className="flex items-center gap-1 text-gray-500 hover:text-green-400 text-sm transition-colors"
                >
                  <Reply className="w-4 h-4" />
                  Reply
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-gray-500 hover:text-white">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-gray-900 border-gray-700">
                    <DropdownMenuItem
                      onClick={() => {
                        setReportingId({ type: 'reply', id: reply.id });
                        setShowReportModal(true);
                      }}
                      className="text-gray-300 hover:bg-gray-800"
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      Report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Nested reply form */}
              {replyingTo === reply.id && (
                <div className="mt-4 flex gap-2">
                  <Textarea
                    value={nestedReplyContent}
                    onChange={(e) => setNestedReplyContent(e.target.value)}
                    placeholder={`Reply to ${reply.author_name}...`}
                    rows={2}
                    className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                  <Button
                    onClick={() => handleSubmitReply(reply.id)}
                    disabled={isSubmitting || !nestedReplyContent.trim()}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nested replies */}
        {reply.replies && reply.replies.length > 0 && (
          <div className="mt-2">
            {reply.replies.map(nested => renderReply(nested, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!discussion) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Discussion Not Found</h2>
            <p className="text-gray-400 mb-6">This discussion may have been removed or does not exist.</p>
            <Button onClick={() => navigate('/forum')} variant="outline" className="border-gray-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Forum
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <Button
            onClick={() => navigate('/forum')}
            variant="ghost"
            className="mb-6 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Forum
          </Button>

          {/* Discussion Header */}
          <Card className="bg-gray-900 border-gray-800 mb-6">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Author Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-yellow-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {discussion.author_name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1">
                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {discussion.is_pinned && (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                        <Pin className="w-3 h-3 mr-1" />
                        Pinned
                      </Badge>
                    )}
                    {discussion.is_locked && (
                      <Badge variant="outline" className="border-gray-500 text-gray-500">
                        <Lock className="w-3 h-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                    {discussion.category && (
                      <Badge
                        style={{
                          backgroundColor: `${discussion.category.color}20`,
                          color: discussion.category.color,
                          borderColor: `${discussion.category.color}50`
                        }}
                        variant="outline"
                      >
                        {discussion.category.icon} {discussion.category.name}
                      </Badge>
                    )}
                  </div>

                  {/* Title */}
                  <h1 className="text-2xl font-bold text-white mb-2">{discussion.title}</h1>

                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span>by <span className="text-gray-300">{discussion.author_name}</span></span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {format(new Date(discussion.created_at), 'MMM d, yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {discussion.views_count} views
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {discussion.replies_count} replies
                    </span>
                  </div>

                  {/* Content */}
                  <div className="text-gray-300 whitespace-pre-wrap mb-4">
                    {discussion.content}
                  </div>

                  {/* Tags */}
                  {discussion.tags && discussion.tags.length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                      {discussion.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
                    <button
                      onClick={() => requireAuth(() => handleVote(discussion.id, 'up'))}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                        userVotes[discussion.id] === 'up'
                          ? 'bg-green-500/20 text-green-400'
                          : 'text-gray-400 hover:bg-gray-800'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>{discussion.upvotes || 0}</span>
                    </button>

                    <button
                      onClick={() => requireAuth(handleBookmark)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                        isBookmarked
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'text-gray-400 hover:bg-gray-800'
                      }`}
                    >
                      <Bookmark className="w-4 h-4" />
                      {isBookmarked ? 'Saved' : 'Save'}
                    </button>

                    <button
                      onClick={handleShare}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>

                    <button
                      onClick={() => {
                        setReportingId({ type: 'discussion', id: discussion.id });
                        setShowReportModal(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors"
                    >
                      <Flag className="w-4 h-4" />
                      Report
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reply Form */}
          {!discussion.is_locked ? (
            <Card className="bg-gray-900 border-gray-800 mb-6">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Leave a Reply</h3>
                {user ? (
                  <div>
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Write your reply..."
                      rows={4}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 mb-4"
                    />
                    <Button
                      onClick={() => handleSubmitReply()}
                      disabled={isSubmitting || !replyContent.trim()}
                      className="bg-gradient-to-r from-green-600 to-yellow-500 hover:from-green-700 hover:to-yellow-600"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Posting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Post Reply
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-400 mb-4">Login to join the discussion</p>
                    <Button
                      onClick={() => navigate('/login')}
                      className="bg-gradient-to-r from-green-600 to-yellow-500"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Login to Reply
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gray-900 border-gray-800 mb-6">
              <CardContent className="p-6 text-center">
                <Lock className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400">This discussion has been locked and no longer accepts new replies.</p>
              </CardContent>
            </Card>
          )}

          {/* Replies Section */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-500" />
              {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
            </h3>

            {replies.length === 0 ? (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-12 text-center">
                  <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No replies yet. Be the first to respond!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {replies.map(reply => renderReply(reply))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Login Prompt Modal */}
      <Dialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white text-xl flex items-center gap-2">
              <LogIn className="w-6 h-6 text-green-500" />
              Login Required
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              You need to be logged in to perform this action.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-yellow-500/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-gray-300 mb-2">Join our community to:</p>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• Reply to discussions</li>
              <li>• Upvote helpful content</li>
              <li>• Save topics for later</li>
            </ul>
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowLoginPrompt(false)}
              className="flex-1 border-gray-700 text-gray-300"
            >
              Continue Reading
            </Button>
            <Button
              onClick={() => {
                setShowLoginPrompt(false);
                navigate('/login');
              }}
              className="flex-1 bg-gradient-to-r from-green-600 to-yellow-500"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white text-xl flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              Report Content
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Why are you reporting this content?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2">
            {['Spam or misleading', 'Harassment or hate speech', 'Inappropriate content', 'Off-topic', 'Other'].map((reason) => (
              <button
                key={reason}
                onClick={() => handleReport(reason)}
                className="w-full text-left px-4 py-3 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                {reason}
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReportModal(false)}
              className="border-gray-700 text-gray-300"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ForumTopic;
