using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using Noizyvox.Unity;

namespace Noizyvox.Samples
{
    /// <summary>
    /// Real-time streaming synthesis demo
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class StreamingDemo : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private NoizyvoxConfig config;
        [SerializeField] private string personaId;
        
        [Header("Streaming Settings")]
        [SerializeField] private int bufferSizeMs = 200;
        [SerializeField] private int sampleRate = 48000;
        
        [Header("UI")]
        [SerializeField] private UnityEngine.UI.InputField inputField;
        [SerializeField] private UnityEngine.UI.Button streamButton;
        [SerializeField] private UnityEngine.UI.Text statusText;
        
        private AudioSource _audioSource;
        private NoizyvoxClient _client;
        private List<float> _audioBuffer;
        private AudioClip _streamingClip;
        private int _writePosition;
        private bool _isStreaming;
        
        private void Awake()
        {
            _audioSource = GetComponent<AudioSource>();
            _client = new NoizyvoxClient(config);
            _audioBuffer = new List<float>();
            
            if (streamButton != null)
                streamButton.onClick.AddListener(OnStreamClicked);
                
            UpdateStatus("Ready");
        }
        
        private async void OnStreamClicked()
        {
            if (_isStreaming)
            {
                StopStreaming();
                return;
            }
            
            string text = inputField?.text ?? "Hello, this is a streaming test!";
            await StartStreamingAsync(text);
        }
        
        public async Task StartStreamingAsync(string text)
        {
            if (_isStreaming) return;
            
            _isStreaming = true;
            _audioBuffer.Clear();
            _writePosition = 0;
            
            UpdateStatus("Connecting...");
            
            // Create streaming clip (30 seconds buffer)
            int clipLength = sampleRate * 30;
            _streamingClip = AudioClip.Create("StreamingClip", clipLength, 1, sampleRate, false);
            _audioSource.clip = _streamingClip;
            
            var request = new SynthesisRequest
            {
                PersonaId = personaId,
                Text = text
            };
            
            try
            {
                UpdateStatus("Streaming...");
                
                bool startedPlayback = false;
                int samplesReceived = 0;
                
                await foreach (var chunk in _client.StreamAsync(request))
                {
                    if (!_isStreaming) break;
                    
                    // Convert bytes to float samples
                    float[] samples = ConvertBytesToFloats(chunk.Data);
                    samplesReceived += samples.Length;
                    
                    // Write to clip
                    _streamingClip.SetData(samples, _writePosition);
                    _writePosition += samples.Length;
                    
                    // Start playback after buffering
                    if (!startedPlayback && samplesReceived >= (sampleRate * bufferSizeMs / 1000))
                    {
                        _audioSource.Play();
                        startedPlayback = true;
                        UpdateStatus("Playing...");
                    }
                    
                    if (chunk.IsFinal)
                    {
                        UpdateStatus("Complete");
                        break;
                    }
                }
            }
            catch (NoizyvoxException ex)
            {
                Debug.LogError($"[StreamingDemo] Error: {ex.Message}");
                UpdateStatus($"Error: {ex.Message}");
            }
            finally
            {
                _isStreaming = false;
            }
        }
        
        public void StopStreaming()
        {
            _isStreaming = false;
            _audioSource.Stop();
            UpdateStatus("Stopped");
        }
        
        private float[] ConvertBytesToFloats(byte[] bytes)
        {
            // Assuming 16-bit PCM
            float[] samples = new float[bytes.Length / 2];
            for (int i = 0; i < samples.Length; i++)
            {
                short sample = (short)(bytes[i * 2] | (bytes[i * 2 + 1] << 8));
                samples[i] = sample / 32768f;
            }
            return samples;
        }
        
        private void UpdateStatus(string status)
        {
            if (statusText != null)
                statusText.text = status;
                
            Debug.Log($"[StreamingDemo] {status}");
        }
        
        private void OnDestroy()
        {
            _client?.Dispose();
            
            if (_streamingClip != null)
                Destroy(_streamingClip);
        }
    }
}
