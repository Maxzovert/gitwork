"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { useDropzone } from "react-dropzone";
import { Presentation, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/cloudinary";
import { CircularProgressbar } from "react-circular-progressbar";
import { api } from "@/trpc/react";
import useProjects from "@/hooks/use-projects";
import { toast } from "sonner";

const MeetingCard = () => {
  const router = useRouter();
  const { project } = useProjects();
  const [progress, setProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const uploadMeeting = api.project.uploadMeeting.useMutation();

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".webm"],
    },
    multiple: false,
    maxSize: 50_000_000,
    onDrop: async (acceptedFiles) => {
      if (!project) return;
      setIsUploading(true);
      const file = acceptedFiles[0];
      if (!file) return;
      const downloadUrl = (await uploadFile(
        file as File,
        setProgress,
      )) as string;

      uploadMeeting.mutate(
        {
          projectId: project?.id,
          meetingUrl: downloadUrl,
          name: file.name,
        },
        {
          onSuccess: () => {
            toast.success("Meeting uploaded successfully");
            router.push("/meetings");
          },
          onError: () => {
            toast.error("Failed to upload meeting");
          },
        },
      );
      setIsUploading(false);
    },
  });

  return (
    <Card
      className="col-span-2 flex flex-col items-center justify-center p-10"
      {...getRootProps()}
    >
      {!isUploading ? (
        <>
          <Presentation className="h-10 w-10 animate-bounce" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">
            Create a new meeting
          </h3>
          <p className="mt-1 text-center text-sm text-gray-500">
            Analyse your meeting with Gitwork.
            <br />
            Powered by AI.
          </p>
          <div className="mt-6">
            <Button disabled={isUploading}>
              <Upload className="mr-1.5 -ml-0.5 h-5 w-5" aria-hidden="true" />
              Upload Meeting
              <input className="hidden" {...getInputProps()} />
            </Button>
          </div>
        </>
      ) : (
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900">
            Uploading… {progress}%
          </p>
        </div>
      )}
      {isUploading && (
        <div className="flex items-center justify-center">
          <CircularProgressbar
            value={progress}
            text={`${progress}%`}
            className="size-20"
          />
          <p className="text-center text-sm text-gray-500">
            Uploading… {progress}%
          </p>
        </div>
      )}
    </Card>
  );
};

export default MeetingCard;
