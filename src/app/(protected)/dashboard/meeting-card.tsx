"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { useDropzone } from "react-dropzone";
import { Presentation, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/cloudinary";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import { api } from "@/trpc/react";
import useProjects from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

type MeetingCardProps = {
  className?: string;
};

const MeetingCard = ({ className }: MeetingCardProps) => {
  const router = useRouter();
  const { project } = useProjects();
  const [progress, setProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const uploadMeeting = api.project.uploadMeeting.useMutation();

  const processMeeting = useMutation({
    mutationFn: async (data: {
      meetingUrl: string;
      meetingId: string;
      projectId: string;
    }) => {
      const { meetingUrl, meetingId, projectId } = data;
      const response = await axios.post("/api/process-meeting", {
        meetingUrl,
        meetingId,
        projectId,
      });
      return response.data;
    },
  });

  const { getRootProps, getInputProps, open } = useDropzone({
    accept: {
      "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".webm"],
    },
    multiple: false,
    maxSize: 50_000_000,
    noClick: true,
    onDrop: async (acceptedFiles) => {
      if (!project) return;
      setIsUploading(true);
      const file = acceptedFiles[0];
      if (!file) return;

      try {
        const downloadUrl = (await uploadFile(
          file as File,
          setProgress,
        )) as string;

        uploadMeeting.mutate(
          {
            projectId: project.id,
            meetingUrl: downloadUrl,
            name: file.name,
          },
          {
            onSuccess: (meeting) => {
              toast.success("Meeting uploaded successfully");
              router.push("/meetings");
              processMeeting.mutateAsync({
                meetingUrl: downloadUrl,
                meetingId: meeting.id,
                projectId: project.id,
              });
            },
            onError: () => {
              toast.error("Failed to upload meeting");
            },
          },
        );
      } catch {
        toast.error("Failed to upload meeting");
      } finally {
        setIsUploading(false);
      }
    },
  });

  return (
    <div
      className={cn(
        "col-span-1 flex h-full min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#d1cdc7] bg-[#fcfbfa] p-6 transition-colors hover:border-[#141413]/40 hover:bg-white lg:col-span-2",
        className,
      )}
      {...getRootProps()}
    >
      {!isUploading ? (
        <>
          <div className="flex size-11 items-center justify-center rounded-lg bg-[#141413] text-[#f3f0ee]">
            <Presentation className="size-5" />
          </div>
          <h3 className="font-display mt-3 text-base tracking-[-0.02em] text-[#141413]">
            Upload a meeting
          </h3>
          <p className="mt-1.5 max-w-[220px] text-center text-sm leading-relaxed text-[#696969]">
            Drop audio here. Gitwork extracts issues automatically.
          </p>
          <div className="mt-4">
            <Button
              disabled={isUploading || !project}
              type="button"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                open();
              }}
            >
              <Upload className="size-4" aria-hidden="true" />
              Choose file
            </Button>
            <input className="hidden" {...getInputProps()} />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="size-20">
            <CircularProgressbar
              value={progress}
              text={`${progress}%`}
              styles={buildStyles({
                pathColor: "#141413",
                textColor: "#141413",
                trailColor: "#d1cdc7",
                textSize: "22px",
              })}
            />
          </div>
          <p className="text-sm font-medium text-[#141413]">
            Uploading… {progress}%
          </p>
        </div>
      )}
    </div>
  );
};

export default MeetingCard;
