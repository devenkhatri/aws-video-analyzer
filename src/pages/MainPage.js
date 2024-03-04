import { Box, Typography, styled, Button, SvgIcon } from "@mui/joy";
import { rekognitionClient } from "../libs/rekognitionClient.js";
import { s3Client } from "../libs/s3Client.js";
import { ListObjectsCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  StartFaceDetectionCommand,
  GetFaceDetectionCommand,
} from "@aws-sdk/client-rekognition";
import { useState } from "react";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Chip from "@mui/joy/Chip";

const BUCKET = "video-analyzer-rekognitiondemobucketcf294c9a-dcy8whqkjqf0";
//const IAM_ROLE_ARN = "arn:aws:iam::746397884673:role/VIDEO-ANALYZER-CognitoDefaultUnauthenticatedRoleABB-fwrvVX975ujY";

const VisuallyHiddenInput = styled("input")`
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  bottom: 0;
  left: 0;
  white-space: nowrap;
  width: 1px;
`;

const MainPage = () => {
  const [newVideo, setNewVideo] = useState();
  const [videoList, setVideoList] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState("")
  const [pending, setPending] = useState(false);

  // Upload the video.
  const uploadVideo = async () => {
    try {
      // Retrieve a list of objects in the bucket.
      const listObjects = await s3Client.send(
        new ListObjectsCommand({ Bucket: BUCKET })
      );
      console.log("Object in bucket: ", listObjects);
      console.log("listObjects.Contents ", listObjects.Contents);

      // const noOfObjects = listObjects.Contents;
      // // If the Amazon S3 bucket is not empty, delete the existing content.
      // if (noOfObjects != null) {
      //   for (let i = 0; i < noOfObjects.length; i++) {
      //     const data = await s3Client.send(
      //       new DeleteObjectCommand({
      //         Bucket: BUCKET,
      //         Key: listObjects.Contents[i].Key,
      //       })
      //     );
      //   }
      // }
      // console.log("Success - bucket empty.");

      // Create the parameters for uploading the video.
      // const videoName = document.getElementById("videoname").innerHTML + ".mp4";
      // const files = document.getElementById("videoupload").files;
      // const file = files[0];
      console.log("***** File", newVideo);
      const uploadParams = {
        Bucket: BUCKET,
        Body: newVideo,
      };
      uploadParams.Key = newVideo.name;
      const data = await s3Client.send(new PutObjectCommand(uploadParams));
      console.log("Success - video uploaded", data);
    } catch (err) {
      console.log("Error while uploading video to S3", err);
    }
  };

  //Get all videos from S3
  const getAllVideos = async () => {
    try {
      const listVideoParams = {
        Bucket: BUCKET,
      };
      setPending(true);
      const data = await s3Client.send(new ListObjectsCommand(listVideoParams));
      console.log("Success - available videos", data);
      const formatedData = data.Contents.map((item) => {
        return {
          id: item.ETag,
          name: item.Key,
          owner: item.Owner.DisplayName,
          date: item.LastModified.toISOString(),
          size: (parseInt(item.Size) / 1024 / 1024).toFixed(2) + " MB",
        };
      });
      console.log("formatedData :  ", formatedData);
      setVideoList(formatedData);
      setPending(false);
    } catch (err) {
      console.log("Error", err);
    }
  };

  const processVideo = async () => {
    console.log("****** selectedVideo", selectedVideo)
    if(!selectedVideo) return;
    try {
      // Create the parameters required to start face detection.
      // const videoName = document.getElementById("videoname").innerHTML;
      const startDetectParams = {
        Video: {
          S3Object: {
            Bucket: BUCKET,
            Name: selectedVideo,
          },
        },
      };
      // Start the Amazon Rekognition face detection process.
      const data = await rekognitionClient.send(
        new StartFaceDetectionCommand(startDetectParams)
      );
      console.log("Success, face detection started. ", data);
      const faceDetectParams = {
        JobId: data.JobId,
      };
      try {
        var finished = false;
        var facesArray = [];
        // Detect the faces.
        while (!finished) {
          var results = await rekognitionClient.send(
            new GetFaceDetectionCommand(faceDetectParams)
          );
          // Wait until the job succeeds.
          if (results.JobStatus === "SUCCEEDED") {
            finished = true;
          }
        }
        finished = false;
        // Parse results into CVS format.
        //const noOfFaces = results.Faces.length;
        var i;
        for (i = 0; i < results.Faces.length; i++) {
          var boundingbox = JSON.stringify(results.Faces[i].Face.BoundingBox);
          var confidence = JSON.stringify(results.Faces[i].Face.Confidence);
          var pose = JSON.stringify(results.Faces[i].Face.Pose);
          var quality = JSON.stringify(results.Faces[i].Face.Quality);
          var arrayfirst = [];
          var arraysecond = [];
          var arraythird = [];
          var arrayforth = [];
          arrayfirst.push(boundingbox);
          arraysecond.push(confidence);
          arraythird.push(pose);
          arrayforth.push(quality);
          arrayfirst.push(arraysecond);
          arrayfirst.push(arraythird);
          arrayfirst.push(arrayforth);
          facesArray.push(arrayfirst);
        }
        console.log("Faces Detection Output: ", facesArray);
      } catch (err) {
        console.log("Error", err);
      }
    } catch (err) {
      console.log("Error", err);
    }
  };

  return (
    <div className="main">
      <div className="main_title_div">
        <Typography level="h3" className="main_title">
          AWS Video Analyzer application
        </Typography>
      </div>
      <Box component="section" sx={{ p: 2, border: "1px solid #f2f2f2" }}>
        <div className="upload_file_text">
          <Typography level="body-md" sx={{ mb: 1, mt: 2 }}>
            Upload a video to an Amazon S3 bucket that will be analyzed!
          </Typography>
          <Button
            component="label"
            role={undefined}
            tabIndex={-1}
            variant="outlined"
            color="neutral"
            startDecorator={
              <SvgIcon>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                  />
                </svg>
              </SvgIcon>
            }
          >
            Upload a Video
            <VisuallyHiddenInput
              type="file"
              accept="video/*"
              onChange={({ target: { files } }) => {
                files[0] && setNewVideo(files[0]);
              }}
            />
          </Button>
          <Typography level="body-md" sx={{ mb: 1, mt: 0 }}>
            Selected Video ={" "}
            {(newVideo && newVideo.name) || "No Video Selected"}
          </Typography>
          <Button variant="soft" onClick={uploadVideo}>
            Add Video
          </Button>
        </div>
      </Box>
      <Box
        component="section"
        sx={{ p: 2, border: "1px solid #f2f2f2", mt: 2 }}
      >
        <Typography level="body-md" sx={{ mb: 1, mt: 0 }}>
          Choose the following button to get information about the video to
          analyze.
        </Typography>
        <Button
          loading={pending ? true : false}
          loadingPosition="start"
          variant="soft"
          onClick={getAllVideos}
        >
          Show Video
        </Button>
        <Typography level="h3" sx={{ mb: 1, mt: 3 }}>
          List of Files
        </Typography>
        <div style={{ width: "100%", overflow: "auto" }}>
          <Select
            placeholder="Select a video to analyse…"
            endDecorator={
              <Chip size="sm" color="success" variant="soft">
                {videoList.length}
              </Chip>
            }
            sx={{ width: "100%" }}
            onChange={(e, newValue) => setSelectedVideo(newValue)}
          >
            {videoList && videoList.map((item) => <Option value={item.name}>{item.name}</Option>)}
          </Select>
          <Typography sx={{ mb: 1, mt: 3 }}>
            <b>Selected Video:</b>
            {selectedVideo && <pre>{JSON.stringify(selectedVideo, null, 2)}</pre>}
          </Typography>
        </div>
      </Box>

      <Box
        component="section"
        sx={{ p: 2, border: "1px solid #f2f2f2", mt: 2 }}
      >
        <Typography level="body-md" sx={{ mb: 1, mt: 0 }}>
          You can generate a report that analyzes a video in an Amazon S3
          bucket.
        </Typography>
        <Typography level="body-md" sx={{ mb: 2, mt: 0 }}>
          Click the following button to analyze the video and obtain a report
        </Typography>
        <Button variant="soft" onClick={processVideo}>
          Analyze Video
        </Button>
        <Typography level="body-md" sx={{ mb: 1, mt: 2 }}>
          Report is being generated:
        </Typography>        
      </Box>
    </div>
  );
};
export default MainPage;
