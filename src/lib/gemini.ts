import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config'; // Loads from .env file


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

export const aiSummariesCommits = async (diff: string) => {
  const response = await model.generateContent([
    `You are an expert programmer, and you are trying to summarize a git diff.
Reminders about the git diff format:
For every file, there are a few metadata lines, like (for example):
\`\`\`
diff --git a/lib/index.js b/lib/index.js
index aadf691..bfef603 100644
--- a/lib/index.js
+++ b/lib/index.js
\`\`\`
This means that \`lib/index.js\` was modified in this commit. Note that this is only an example.

Then there is a specifier of the lines that were modified.
A line starting with \`+\` means it was added.
A line that starting with \`-\` means that line was deleted.
A line that starts with neither \`+\` nor \`-\` is code given for context and better understanding.
It is not part of the diff.

[...]
EXAMPLE SUMMARY COMMENTS:
\`\`\`
* Raised the amount of returned recordings from \`10\` to \`100\` [packages/server/recordings_api.ts], [packages/server/constants.ts]
* Fixed a typo in the github action name [.github/workflows/gpt-commit-summarizer.yml]
* Moved the \`octokit\` initialization to a separate file [src/octokit.ts], [src/index.ts]
* Added an OpenAI API for completions [packages/utils/apis/openai.ts]
* Lowered numeric tolerance for test files
\`\`\`

Most commits will have less comments than this examples list.
The last comment does not include the file names,
because there were more than two relevant files in the hypothetical commit.

Do not include parts of the example in your summary.
It is given only as an example of appropriate comments.

Please summarise the following diff file:

\`\`\`diff
${diff}
\`\`\`
`,
  ]);

  return response.response.text();
};


const run = async () => {
  const diffText = `
  diff --git a/app/course/[courseId]/qa/page.jsx b/app/course/[courseId]/qa/page.jsx
index 3d6b7db..5c633f2 100644
--- a/app/course/[courseId]/qa/page.jsx
+++ b/app/course/[courseId]/qa/page.jsx
@@ -1,51 +1,72 @@
-'use client'
+"use client";
 import axios from "axios";
-import { useParams } from "next/navigation"
-import React, { useEffect, useState } from 'react'
+import { useParams } from "next/navigation";
+import React, { useEffect, useState } from "react";
 import StepProgress from "../_components/StepProgress";
 
 function QuestionAnswers() {
-    const {courseId} = useParams();
-    const [qA , setQA] = useState([]);
-    const [qaData , setQAData] = useState();
-     const [stepCount , setStepCount] = useState(0);
-
-
-    useEffect(()=>{
-        GetQuestionAnswers();
-    },[])
-    const GetQuestionAnswers = async() => {
-        const result = await axios.post('/api/study-type',{
-            courseId : courseId,
-            studyType : 'Question/Answer'
-        })
-
-        console.log(result);
-        setQAData(result.data)
-        setQA(result.data[0].content.QuestionAnswers);
+  const { courseId } = useParams();
+  const [qA, setQA] = useState([]);
+  const [qaData, setQAData] = useState();
+  const [stepCount, setStepCount] = useState(0);
+
+  useEffect(() => {
+    if (courseId) {
+      GetQuestionAnswers();
     }
+  }, [courseId]);
+
+  const GetQuestionAnswers = async () => {
+    try {
+      const result = await axios.post("/api/study-type", {
+        courseId: courseId,
+        studyType: "Question/Answer",
+      });
+
+      console.log("API Result:", result);
+
+      const qaContent = result?.data?.[0]?.content?.QuestionAnswers;
+
+      if (Array.isArray(qaContent)) {
+        setQAData(result.data);
+        setQA(qaContent);
+      } else {
+        setQA([]);
+      }
+    } catch (error) {
+      console.error("Error fetching QAs:", error);
+      setQA([]); // fallback to avoid crashing
+    }
+  };
 
   return (
     <div>
-      <h2 className="font-bold text-2xl text-center mb-10">Question / Answers</h2>
-      <StepProgress data={qA} stepCount={stepCount} setStepCount={(value)=>setStepCount(value)}/>
-      {qA.length > 0 ? (
+      <h2 className="font-bold text-2xl text-center mb-10">
+        Question / Answers
+      </h2>
+      <StepProgress
+        data={qA}
+        stepCount={stepCount}
+        setStepCount={(value) => setStepCount(value)}
+      />
+      {Array.isArray(qA) && qA.length > 0 ? (
         <div>
-                <h2 className="text-center font-bold mt-10">Question No: {stepCount + 1}</h2>
-                <div className="p-4 border rounded-lg shadow-md mt-4 text-center">
-                    <h1 className="font-semibold text-lg">{qA[stepCount]?.question}</h1>
-                </div>
-                <h2 className="text-center font-bold mt-10">Answer</h2>
-                <div className="p-4 border rounded-lg shadow-md mt-4">
-                    <p >{qA[stepCount]?.answer}</p>
-                </div>
-
+          <h2 className="text-center font-bold mt-10">
+            Question No: {stepCount + 1}
+          </h2>
+          <div className="p-4 border rounded-lg shadow-md mt-4 text-center">
+            <h1 className="font-semibold text-lg">{qA[stepCount]?.question}</h1>
+          </div>
+          <h2 className="text-center font-bold mt-10">Answer</h2>
+          <div className="p-4 border rounded-lg shadow-md mt-4">
+            <p>{qA[stepCount]?.answer}</p>
+          </div>
         </div>
-            ) : (
-                <p className="text-center">Loading questions...</p>
-            )}
+      ) : (
+        <p className="text-center">Loading questions...</p>
+      )}
     </div>
-  )
+  );
 }
 
-export default QuestionAnswers
+export default QuestionAnswers;
diff --git a/inngest/client.js b/inngest/client.js
index bd535c8..fc0c772 100644
--- a/inngest/client.js
+++ b/inngest/client.js
@@ -1,4 +1,7 @@
 import { Inngest } from "inngest";
 
 // Create a client to send and receive events
-export const inngest = new Inngest({ id: "thryve" });
+export const inngest = new Inngest({ 
+    id: "thryve",
+    eventKey : process.env.INNGEST_EVENT_KEY
+});
  `;

  const summary = await aiSummariesCommits(diffText);
  console.log(summary);
};
run();