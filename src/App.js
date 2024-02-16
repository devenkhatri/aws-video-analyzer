import "./App.css";
import styled from "styled-components";
import DataTable from "react-data-table-component";

import { rekognitionClient } from "./libs/rekognitionClient.js";
import { s3Client } from "./libs/s3Client.js";
import { sesClient } from "./libs/sesClient.js";
import { SendEmailCommand } from "@aws-sdk/client-ses";
import { DeleteObjectCommand, ListObjectsCommand } from "@aws-sdk/client-s3";
import {
  StartFaceDetectionCommand,
  GetFaceDetectionCommand,
} from "@aws-sdk/client-rekognition";
import { useState } from "react";
import FileInput from "./components/FileInput.js";
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

const App = () => {

  const [newVideo, setNewVideo] = useState("No Video Selected");

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

  const data = [
    {
      id: 1,
      title: "Beetlejuice",
      year: "1988",
    },
    {
      id: 2,
      title: "Ghostbusters",
      year: "1984",
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

      const noOfObjects = listObjects.Contents;
      // If the Amazon S3 bucket is not empty, delete the existing content.
      if (noOfObjects != null) {
        for (let i = 0; i < noOfObjects.length; i++) {
          const data = await s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET,
              Key: listObjects.Contents[i].Key,
            })
          );
        }
      }
      console.log("Success - bucket empty.");

      // Create the parameters for uploading the video.
      // const videoName = document.getElementById("videoname").innerHTML + ".mp4";
      // const files = document.getElementById("videoupload").files;
      // const file = files[0];
      // const uploadParams = {
      //   Bucket: BUCKET,
      //   Body: file,
      // };
      // uploadParams.Key = path.basename(file.name);
      // const data = await s3Client.send(new PutObjectCommand(uploadParams));
      // console.log("Success - video uploaded");
    } catch (err) {
      console.log("Error", err);
    }
  };

  return (
    <Container>
      <Heading>AWS Video Analyzer application</Heading>
      <Section>
        <p>Upload a video to an Amazon S3 bucket that will be analyzed!</p>
        {/* <input type="file" name="file" value={newVideo} onChange={e => setNewVideo(e.target.files && e.target.files[0].name)} /> */}
        {/* <input type="file" name="file" value={newVideo} onChange={e => console.log(e.target.files && e.target.files[0])} /> */}
        <input type="file" accept='video/*' 
        onChange={({ target: {files}}) => {
          files[0] && setNewVideo(files[0].name)
        }}
         />
        <br />Selected Video = {newVideo}
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
        <Button onClick="getVideo()">Show Video</Button>
        <DataTable
          columns={columns}
          data={data}
          customStyles={tableCustomStyles}
          highlightOnHover
          pointerOnHover
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
          <Button id="button" onClick="ProcessImages()">
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

export default App;
