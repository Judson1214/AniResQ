import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPosts } from "@/services/lostfound.service";
import { MainLayout } from "@/components/layout/MainLayout";
import { LostFoundCard } from "@/components/lostfound/LostFoundCard";
import { LostFoundForm } from "@/components/lostfound/LostFoundForm";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LostFoundType } from "@aniresq/shared-types";
function LostFoundPage() {
  const [activeTab, setActiveTab] = useState("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: posts, isLoading, refetch } = useQuery({
    queryKey: ["lostfound", activeTab],
    queryFn: () => getPosts({ type: activeTab !== "ALL" ? activeTab : void 0 })
  });
  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">Lost & Found</h1>
            <p className="text-slate-400">Help reunite missing pets with their families, or report a found animal.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20">Report Lost/Found</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0A0F1C] border-slate-800 text-white">
              <DialogHeader>
                <DialogTitle className="text-xl">Report a Pet</DialogTitle>
              </DialogHeader>
              <LostFoundForm onSuccess={() => {
                setIsDialogOpen(false);
                refetch();
              }} />
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="mb-6">
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger value="ALL" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">All Reports</TabsTrigger>
            <TabsTrigger value={LostFoundType.LOST} className="data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-400 text-slate-400">Lost Pets</TabsTrigger>
            <TabsTrigger value={LostFoundType.FOUND} className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-slate-400">Found Pets</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-80 bg-slate-900 border border-slate-800 animate-pulse rounded-2xl" />)}
          </div>
        ) : posts?.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/50 border border-slate-800 rounded-2xl">
            <p className="text-slate-500">No reports found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {posts?.map((post) => <LostFoundCard key={post.id} post={post} onUpdate={refetch} />)}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
export {
  LostFoundPage as default
};
