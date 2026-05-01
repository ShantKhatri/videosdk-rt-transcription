import { useState, useEffect, useRef } from "react";
import {
  MeetingProvider,
  useMeeting,
  useParticipant,
  useTranscription,
  Constants,
  VideoPlayer,
} from "@videosdk.live/react-sdk";
import { authToken, createMeeting } from "./API";
import "./App.css";


function JoinScreen({ onJoin }) {
  const [meetingId, setMeetingId] = useState("");
  const [name, setName]           = useState("");

  const handleCreate = async () => {
    const id = await createMeeting({ token: authToken });
    onJoin(id, name || "Speaker");
  };

  return (
    <div className="join-screen">
      <h1>Live Transcription</h1>
      <p>Speak during the call — your words appear as live captions.</p>
      <input placeholder="Your name" onChange={e => setName(e.target.value)} />
      <input placeholder="Meeting ID (leave blank to create new)" onChange={e => setMeetingId(e.target.value)} />
      <div className="row">
        <button onClick={() => onJoin(meetingId, name || "Speaker")}>Join</button>
        <button className="btn--primary" onClick={handleCreate}>New Meeting</button>
      </div>
    </div>
  );
}

function ParticipantView({ participantId }) {
  const { displayName, webcamOn, micOn, micStream, isLocal } = useParticipant(participantId);
  const micRef = useRef(null);

  useEffect(() => {
    if (!micRef.current) return;
    if (micOn && micStream) {
      const stream = new MediaStream([micStream.track]);
      micRef.current.srcObject = stream;
      micRef.current.play().catch(console.error);
    } else {
      micRef.current.srcObject = null;
    }
  }, [micOn, micStream]);

  return (
    <div className="tile">
      <audio ref={micRef} autoPlay playsInline muted={isLocal} />
      {webcamOn
        ? <VideoPlayer participantId={participantId} type="video"
            containerStyle={{ height: 180, width: 240, borderRadius: 8 }} />
        : <div className="tile__avatar">{displayName?.[0]?.toUpperCase()}</div>
      }
      <div className="tile__name">{displayName} {!micOn && "🔇"}</div>
    </div>
  );
}


// Reference: https://docs.videosdk.live/react/guide/video-and-audio-calling-api-sdk/transcription-and-summary/realtime-transcribe-meeting
function TranscriptionPanel() {
  const [lines, setLines]   = useState([]);
  const [status, setStatus] = useState("idle");
  const bottomRef           = useRef(null);

  const { startTranscription, stopTranscription } = useTranscription({

    onTranscriptionStateChanged: ({ status: s }) => {
      if (s === Constants.transcriptionEvents.TRANSCRIPTION_STARTING) setStatus("starting");
      else if (s === Constants.transcriptionEvents.TRANSCRIPTION_STARTED)  setStatus("live");
      else if (s === Constants.transcriptionEvents.TRANSCRIPTION_STOPPING) setStatus("stopping");
      else if (s === Constants.transcriptionEvents.TRANSCRIPTION_STOPPED)  setStatus("idle");
    },

    onTranscriptionText: ({ participantName, text }) => {
      setLines(prev => [...prev, { speaker: participantName, text }]);
    },
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  const toggle = () => {
    if (status === "idle") {
      startTranscription({ webhookUrl: null, summary: { enabled: false } });
    } else if (status === "live") {
      stopTranscription();
    }
  };

  const statusLabel = { idle: "Start Captions", starting: "Starting...", live: "Stop Captions", stopping: "Stopping..." };

  return (
    <div className="transcription-panel">
      <div className="transcription-panel__header">
        <h3>Live Captions</h3>
        {status === "live" && <span className="live-badge">LIVE</span>}
        <button
          className={`caption-btn ${status === "live" ? "caption-btn--stop" : ""}`}
          onClick={toggle}
          disabled={status === "starting" || status === "stopping"}
        >
          {statusLabel[status]}
        </button>
      </div>

      <div className="captions">
        {lines.length === 0 && status !== "live" && (
          <p className="captions__empty">Click "Start Captions" then speak — your words appear here.</p>
        )}
        {lines.length === 0 && status === "live" && (
          <p className="captions__empty">Listening...</p>
        )}
        {lines.map((line, i) => (
          <div key={i} className="caption-line">
            <span className="caption-line__speaker">{line.speaker}</span>
            <span className="caption-line__text">{line.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MeetingView({ meetingId, onLeave }) {
  const [joined, setJoined] = useState(false);

  const { join, leave, participants } = useMeeting({
    onMeetingJoined: () => setJoined(true),
    onMeetingLeft:   onLeave,
  });

  return (
    <div className="meeting">
      <div className="meeting__header">
        <h2>Live Transcription Demo &nbsp;<code>{meetingId}</code></h2>
        <button className="leave-btn" onClick={leave}>Leave</button>
      </div>

      {!joined ? (
        <button className="join-btn" onClick={join}>Join Meeting</button>
      ) : (
        <div className="meeting__body">
          <div className="grid">
            {[...participants.keys()].map(id => (
              <ParticipantView key={id} participantId={id} />
            ))}
          </div>
          <TranscriptionPanel />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);

  return session ? (
    <MeetingProvider
      config={{ meetingId: session.meetingId, name: session.name, micEnabled: true, webcamEnabled: true }}
      token={authToken}
    >
      <MeetingView meetingId={session.meetingId} onLeave={() => setSession(null)} />
    </MeetingProvider>
  ) : (
    <JoinScreen onJoin={(id, name) => setSession({ meetingId: id, name })} />
  );
}