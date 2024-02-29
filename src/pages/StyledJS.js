import styled from "styled-components";
import DataTable from "react-data-table-component"; //https://react-data-table-component.netlify.app/

import { rekognitionClient } from "../libs/rekognitionClient.js";
import { s3Client } from "../libs/s3Client.js";
import { sesClient } from "../libs/sesClient.js";
import { SendEmailCommand } from "@aws-sdk/client-ses";
import {
  DeleteObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  StartFaceDetectionCommand,
  GetFaceDetectionCommand,
} from "@aws-sdk/client-rekognition";
import { useState } from "react";
import FileInput from "../components/FileInput.js";
const BUCKET = "video-analyzer-rekognitiondemobucketcf294c9a-dcy8whqkjqf0";
const IAM_ROLE_ARN =
  "arn:aws:iam::746397884673:role/VIDEO-ANALYZER-CognitoDefaultUnauthenticatedRoleABB-fwrvVX975ujY";

const primaryColor = "#afdbd2";
const secondaryColor = "papayawhip";

const Container = styled.div`
  width: 100%;
  border: 1px solid white;
  background-color: ${primaryColor};
  text-align: center;
`;

const Heading = styled.h1``;

const Section = styled.section`
  padding: 1em;
  background: ${secondaryColor};
  border-top: 1px solid #36313d;
`;

const Button = styled.button`
  background: ${primaryColor};
  margin: 1em;
  padding: 0.25em 1em;
  border-radius: 3px;
`;

const tableCustomStyles = {
  headRow: {
    style: {
      border: "none",
    },
  },
  headCells: {
    style: {
      backgroundColor: primaryColor,
      color: "#202124",
      fontSize: "14px",
    },
  },
  rows: {
    highlightOnHoverStyle: {
      backgroundColor: "rgb(230, 244, 244)",
      borderBottomColor: "#FFFFFF",
      outline: "1px solid #FFFFFF",
    },
  },
  pagination: {
    style: {
      border: "none",
    },
  },
};

const StyledJS = () => {
    const [newVideo, setNewVideo] = useState();
    const [tableData, setTableData] = useState([]);
    const [pending, setPending] = useState(false);
    
    const columns = [
    {
      name: "Name",
      selector: (row) => row.name,
    },
    {
      name: "Owner",
      selector: (row) => row.owner,
    },
    {
      name: "Date",
      selector: (row) => row.date,
    },
    {
      name: "Size",
      selector: (row) => row.size,
    },
    ];
    
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
      Bucket: BUCKET
    };
    setPending(true);
    const data = await s3Client.send(new ListObjectsCommand(listVideoParams));
    console.log("Success - available videos", data);
    const formatedData = data.Contents.map(((item) => {
      return  {
        id: item.ETag,
        name: item.Key,
        owner: item.Owner.DisplayName,
        date: item.LastModified.toISOString(),
        size: (parseInt(item.Size) / 1024 / 1024).toFixed(2) + " MB"
      }
    }))
    
    setTableData(formatedData);
    setPending(false);
    } catch (err) {
    console.log("Error", err);
    }
    };
    
    const processVideo = async () => {
    try {
    // Create the parameters required to start face detection.
    const videoName = document.getElementById("videoname").innerHTML;
    const startDetectParams = {
      Video: {
        S3Object: {
          Bucket: BUCKET,
          Name: videoName
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
        if (results.JobStatus == "SUCCEEDED") {
          finished = true;
        }
      }
      finished = false;
      // Parse results into CVS format.
      const noOfFaces = results.Faces.length;
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
      console.log("Faces Detection Output: ",facesArray);
    } catch (err) {
      console.log("Error", err);
    }
    } catch (err) {
    console.log("Error", err);
    }
    };
    
    return (
    //Bootstrap UI
    
    
    <Container>
      <Heading>AWS Video Analyzer application</Heading>
      <Section>
        <p>Upload a video to an Amazon S3 bucket that will be analyzed!</p>
        {/* <input type="file" name="file" value={newVideo} onChange={e => setNewVideo(e.target.files && e.target.files[0].name)} /> */}
        {/* <input type="file" name="file" value={newVideo} onChange={e => console.log(e.target.files && e.target.files[0])} /> */}
        <input
          type="file"
          accept="video/*"
          onChange={({ target: { files } }) => {
            files[0] && setNewVideo(files[0]);
          }}
        />
        <br />
        Selected Video = {(newVideo && newVideo.name) || "No Video Selected"}
        <br />
        <Button id="addvideo" onClick={uploadVideo}>
          Add video
        </Button>
      </Section>
      <Section>
        <p>
          Choose the following button to get information about the video to
          analyze.
        </p>
        <Button onClick={getAllVideos}>Show Video</Button>
        <DataTable
          title="List of Files"
          columns={columns}
          data={tableData}
          customStyles={tableCustomStyles}
          progressPending={pending}
          highlightOnHover
          pointerOnHover
          selectableRows
        />
      </Section>
      <Section>
        <p>
          You can generate a report that analyzes a video in an Amazon S3
          bucket.{" "}
        </p>
        <div>
          <p>
            Click the following button to analyze the video and obtain a report
          </p>
          <Button id="button" onClick={processVideo}>
            Analyze Video
          </Button>
        </div>
        <div id="spinner">
          <p>Report is being generated:</p>
        </div>
      </Section>
    </Container>
    );
};

export default StyledJS;