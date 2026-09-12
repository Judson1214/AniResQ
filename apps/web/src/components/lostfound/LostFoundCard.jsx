import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LostFoundStatus, LostFoundType } from "@aniresq/shared-types";
import { formatRelativeTime } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { updatePostStatus, getReplies, addReply } from "@/services/lostfound.service";
import { MapPin, Phone, MessageCircle, Send } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const CommentsDialog = ({ post }) => {
  const [text, setText] = useState("");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const { data: replies, isLoading } = useQuery({
    queryKey: ["lostfound-replies", post.id],
    queryFn: () => getReplies(post.id)
  });
  
  const mutation = useMutation({
    mutationFn: () => addReply(post.id, text),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries(["lostfound-replies", post.id]);
    }
  });
  
  return (
    <DialogContent className="max-w-md h-[500px] flex flex-col bg-[#0A0F1C] text-white border-slate-800">
      <DialogHeader>
        <DialogTitle>Sightings & Replies</DialogTitle>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto space-y-4 p-2">
        {isLoading ? (
          <p className="text-slate-400">Loading replies...</p>
        ) : replies?.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No replies yet. Be the first to help!</p>
        ) : (
          replies?.map((reply) => (
            <div key={reply.id} className="bg-[#131B2C] border border-slate-800 p-3 rounded-lg">
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-sm text-blue-400">{reply.userName}</span>
                <span className="text-xs text-slate-500">{formatRelativeTime(reply.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-300">{reply.text}</p>
            </div>
          ))
        )}
      </div>
      
      {user ? (
        <div className="flex gap-2 pt-4 border-t border-slate-800 mt-auto">
          <Input 
            value={text} 
            onChange={e => setText(e.target.value)} 
            placeholder="I saw this animal at..."
            className="bg-slate-900 border-slate-700 text-white"
            onKeyDown={e => e.key === 'Enter' && text && mutation.mutate()}
          />
          <Button onClick={() => mutation.mutate()} disabled={!text || mutation.isPending} size="icon" className="bg-blue-600 hover:bg-blue-500 shrink-0">
            <Send size={18} />
          </Button>
        </div>
      ) : (
        <div className="pt-4 border-t border-slate-800 text-center text-sm text-slate-400 mt-auto">
          Please login to reply.
        </div>
      )}
    </DialogContent>
  );
};

const LostFoundCard = ({ post, onUpdate }) => {
  const { user } = useAuth();
  const isOwner = user?.uid === post.reporterId;
  
  const handleResolve = async () => {
    if (post.id) {
      await updatePostStatus(post.id, LostFoundStatus.RESOLVED);
      if (onUpdate) onUpdate();
    }
  };

  return (
    <Card className={`overflow-hidden bg-[#131B2C] border-slate-800 text-white ${post.status === LostFoundStatus.RESOLVED ? "opacity-60 grayscale" : ""}`}>
      <div className="h-48 bg-slate-900 relative">
        {post.photoUrls?.[0] ? (
          <img src={post.photoUrls[0]} alt={post.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500">No Photo</div>
        )}
        <div className="absolute top-2 right-2 flex gap-2">
          <Badge className={post.type === LostFoundType.LOST ? "bg-rose-500" : "bg-emerald-500"}>
            {post.type}
          </Badge>
          {post.status === LostFoundStatus.RESOLVED && <Badge className="bg-slate-700">RESOLVED</Badge>}
        </div>
      </div>
      
      <CardContent className="p-5 space-y-3">
        <div>
          <h3 className="font-bold text-lg line-clamp-1">{post.title}</h3>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{post.color} {post.breed} {post.species}</p>
        </div>

        <p className="text-sm line-clamp-2 text-slate-300">{post.description}</p>

        <div className="text-sm text-slate-400 space-y-1 bg-slate-900/50 p-2 rounded border border-slate-800">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-emerald-400" /> <span className="line-clamp-1">{post.lastSeenAddress}</span>
          </div>
          <div className="text-xs pl-6 text-slate-500">
            Reported {formatRelativeTime(post.createdAt)}
          </div>
        </div>

        {post.status === LostFoundStatus.ACTIVE && (
          <div className="pt-2 border-t border-slate-800 flex items-center gap-2 text-sm text-slate-300">
            <Phone size={14} className="text-blue-400" />
            <span className="font-medium">{post.contactPhone}</span>
          </div>
        )}

        <div className="pt-2 flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 bg-slate-800 hover:bg-slate-700 border-slate-700 text-white gap-2">
                <MessageCircle size={16} /> Replies
              </Button>
            </DialogTrigger>
            <CommentsDialog post={post} />
          </Dialog>

          {isOwner && post.status === LostFoundStatus.ACTIVE && (
            <Button variant="secondary" className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={handleResolve}>
              Resolve
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export { LostFoundCard };
