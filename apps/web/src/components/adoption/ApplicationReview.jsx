import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApplicationStatus } from "@aniresq/shared-types";
const ApplicationReview = ({ application, onReview }) => {
  const [notes, setNotes] = useState("");
  return <div className="bg-white p-6 rounded-lg shadow-sm border space-y-6">
      <h3 className="text-xl font-semibold">Application Review</h3>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <p className="text-gray-500">Applicant ID</p>
          <p className="font-medium">{application.applicantId}</p>
        </div>
        <div className="space-y-1">
          <p className="text-gray-500">Status</p>
          <p className="font-medium">{application.status}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 border-b pb-2">Answers</h4>
        {application.answers && Object.entries(application.answers).map(([key, val]) => <div key={key} className="text-sm">
            <p className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</p>
            <p className="font-medium">{String(val)}</p>
          </div>)}
      </div>

      <div className="space-y-2 pt-4 border-t">
        <label className="text-sm font-medium">Screening Notes</label>
        <Textarea
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
    placeholder="Add internal notes or feedback for the applicant..."
  />
      </div>

      <div className="flex gap-4">
        <Button
    variant="outline"
    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
    onClick={() => onReview(ApplicationStatus.REJECTED, notes)}
  >
          Reject
        </Button>
        <Button
    className="w-full bg-green-600 hover:bg-green-700"
    onClick={() => onReview(ApplicationStatus.APPROVED, notes)}
  >
          Approve
        </Button>
      </div>
    </div>;
};
export {
  ApplicationReview
};
