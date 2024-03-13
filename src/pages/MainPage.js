import {
  Box,
  Typography,
  styled,
  Button,
  SvgIcon,
  LinearProgress,
  Grid,
} from "@mui/joy";
import { rekognitionClient } from "../libs/rekognitionClient.js";
import { s3Client } from "../libs/s3Client.js";
import { ListObjectsCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  GetTextDetectionCommand,
  StartTextDetectionCommand,
} from "@aws-sdk/client-rekognition";
import { useState } from "react";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Chip from "@mui/joy/Chip";
import Snackbar from "@mui/joy/Snackbar";

import { AgGridReact } from "ag-grid-react"; // AG Grid Component
import "ag-grid-community/styles/ag-grid.css"; // Mandatory CSS required by the grid
import "ag-grid-community/styles/ag-theme-alpine.css"; // Optional Theme applied to the grid

//saved result from rekognition to avoid multiple calls while testing
// import jobresult from "../temp-results/jobresult.js";
// import processedresult from "../temp-results/processedresult.js";

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
  const [selectedVideo, setSelectedVideo] = useState("");
  const [fetchInProgress, setFetchInProgress] = useState(false);
  const [detectedTextsArray, setDetectedTextsArray] = useState([]);
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const [progressIndicator, setProgressIndicator] = useState(0);
  const [openSnackbar, setOpenSnackbar] = useState(false);

  // Column Definitions: Defines the columns to be displayed.
  const [resultColumns] = useState([
    { field: "DetectedText",flex: 2, filter: true, floatingFilter: true },
    { field: "TimeStamp",flex: 1, valueFormatter: p => 'at ' + p.value },
    { field: "Confidence",flex: 1, valueFormatter: p => p.value+' %' },
  ]);

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
      setFetchInProgress(true);
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
      setFetchInProgress(false);
    } catch (err) {
      console.log("Error", err);
    }
  };

  const processVideo = async () => {
    console.log("****** selectedVideo", selectedVideo);
    if (!selectedVideo) {
      setOpenSnackbar(true);
      return;
    }
    setAnalysisInProgress(true);
    try {
      // Create the parameters required to start text detection.
      const startDetectParams = {
        Video: {
          S3Object: {
            Bucket: BUCKET,
            Name: selectedVideo,
          },
        },
      };
      // Start the Amazon Rekognition text detection process.
      const data = await rekognitionClient.send(
        new StartTextDetectionCommand(startDetectParams)
      );
      console.log("Success, text detection started. ", data);
      const textDetectParams = {
        JobId: data.JobId,
      };
      try {
        setDetectedTextsArray([]);
        setProgressIndicator(0);
        var finished = false;
        // Detect the faces.
        while (!finished) {
          console.log("** Job in progress", data, new Date());
          var results = await rekognitionClient.send(
            new GetTextDetectionCommand(textDetectParams)
          );
          const now = new Date();
          let seconds = now.getSeconds();
          console.log("**** Job results", results, new Date());
          setProgressIndicator((seconds * 100) / 60);
          // Wait until the job succeeds.
          if (results.JobStatus === "SUCCEEDED") {
            finished = true;
            setProgressIndicator(100);
            setAnalysisInProgress(false);
          }
        }
        finished = false;

        //show the result
        showResult(results);
      } catch (err) {
        console.log("Error", err);
      }
    } catch (err) {
      console.log("Error", err);
    }
  };

  // const processVideo = async () => {
  //   showResult(jobresult);
  // };

  const showResult = (results) => {
    var outputArray = [];
    var i;
    for (i = 0; i < results.TextDetections.length; i++) {
      if (
        results.TextDetections[i].TextDetection.Type === "LINE" &&
        results.TextDetections[i].TextDetection.DetectedText?.length > 2
      )
        // outputArray.push({ ...results.TextDetections[i] });
        outputArray.push({
          DetectedText: results.TextDetections[i].TextDetection.DetectedText,
          TimeStamp: formatTime(parseInt(results.TextDetections[i].Timestamp)),
          Confidence: parseFloat(
            results.TextDetections[i].TextDetection.Confidence
          ).toFixed(2),
        });

      setDetectedTextsArray(outputArray);
    }
    console.log("Text Detection Output: ", outputArray);
  };

  const formatTime = (milliseconds) => {
    const seconds = Math.floor((milliseconds / 1000) % 60);
    const minutes = Math.floor((milliseconds / 1000 / 60) % 60);
    const hours = Math.floor((milliseconds / 1000 / 60 / 60) % 24);

    return [
      hours.toString().padStart(2, "0"),
      minutes.toString().padStart(2, "0"),
      seconds.toString().padStart(2, "0"),
    ].join(":");
  };

  return (
    <div className="main">
      <div className="main_title_div">
        <Typography level="h3" className="main_title">
          AWS Video Analyzer application
        </Typography>
      </div>
      <Snackbar
        autoHideDuration={5000}
        variant="solid"
        // variant="soft"
        color="danger"
        size="lg"
        open={openSnackbar}
        onClose={() => setOpenSnackbar(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        endDecorator={
          <Button
            onClick={() => setOpenSnackbar(false)}
            size="sm"
            variant="soft"
            color="danger"
          >
            Dismiss
          </Button>
        }
      >
        No video selected in <strong>Step-2</strong> 
      </Snackbar>
      <Box component="section" sx={{ p: 2, border: "2px solid #f2f2f2" }}>
        <Chip color="primary" variant="solid" sx={{ mb: 1 }}>
          1
        </Chip>
        <div className="upload_file_text">
          <Typography level="body-md">
            REQUIRED ONLY ONCE. Select the video from local to be analysed. This
            step is required to be done only once per video!
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
        sx={{ p: 2, border: "2px solid #f2f2f2", mt: 2 }}
      >
        <Grid container sx={{ flexGrow: 1 }}>
          <Grid md={12}>
            <Chip color="primary" variant="solid" sx={{ mb: 1 }}>
              2
            </Chip>
            <Typography level="body-md" sx={{ mb: 1, mt: 0 }}>
              Fetch already uploaded videos list and Choose the following button
              to get information about the video to analyze.
            </Typography>
            <Button
              loading={fetchInProgress}
              loadingPosition="start"
              variant="soft"
              onClick={getAllVideos}
            >
              Fetch Video List
            </Button>
          </Grid>          
          <Grid md={12}>
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
                {videoList &&
                  videoList.map((item) => (
                    <Option key={item.id} value={item.name}>
                      {item.name}
                    </Option>
                  ))}
              </Select>
              <Typography sx={{ mb: 1, mt: 3 }}>
                <b>Selected Video:</b> {selectedVideo}
              </Typography>
            </div>
          </Grid>          
        </Grid>
      </Box>

      <Box
        component="section"
        sx={{ p: 2, border: "2px solid #f2f2f2", mt: 2 }}
      >
        <Chip color="primary" variant="solid" sx={{ mb: 1 }}>
          3
        </Chip>
        <Typography level="body-md" sx={{ mb: 2, mt: 0 }}>
          Click the following button to analyze the above selected video and
          obtain a report
        </Typography>
        <Button
          variant="soft"
          onClick={processVideo}
          loading={analysisInProgress}
          loadingPosition="start"
        >
          Analyze Video
        </Button>
        <LinearProgress determinate value={progressIndicator} sx={{ mt: 1 }} />
        <Typography level="body-md" sx={{ mb: 1, mt: 2 }}>
          Video Analysis Report:
        </Typography>
        <div
          className="ag-theme-alpine" // applying the grid theme
          style={{ height: 500 }} // the grid will fill the size of the parent container
        >
          <AgGridReact
            rowData={detectedTextsArray}
            columnDefs={resultColumns}
            rowSelection="single"
            pagination={true}
          />
        </div>        
      </Box>
    </div>
  );
};
export default MainPage;
