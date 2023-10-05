# ICP Music App
This is a simple application for adding public songs and creating personal playlists.

## How to run

The project runs on [AZLE](https://demergent-labs.github.io/azle/the_azle_book.html). To test:

- Clone the repo

```
git clone https://github.com/TMCrypto/Music-App.git
```

- Move to the repo directory

```
cd Music-App
```

- Install the packages

```
npm install
```

- Start the ICP blockchain locally

```
dfx start --background --clean
dfx deploy
```

- Deploy the canister on the local blockchain

```
dfx deploy
```

- Example CLI command that can run the existing functions of the canister (uploadSong, createPlaylist, getSong, getSongs, getPlaylist, getPlaylists, updatePlaylist, addSongsToPlaylist, deletePlaylist, deleteSongFromPlaylist).

1. Uploading a song (mimeType examples - audio/mp4, audio/mpeg, audio/wav):
```
dfx canister call music_app uploadSong '(record { "fileName"= "<name-of-the-file>.<mimeType>"; "mimeType"= "audio/mp4"; "title"= "<song-title>"; "singers"= vec { "singer1"; "singer2"; etc... }; "genre"= "<song-genre>"; "duration"= <duration-in-seconds>; "releaseDate"= "<song-release-date>"})'
```

2. Create a playlist
```
dfx canister call music_app createPlaylist '(record { "name"= "Some name"; "description"= "Some description" })'
```

3. Get a specific song from the storage
```
dfx canister call music_app getSong '("<song-id>")'
```

4. Get all songs from the storage
```
dfx canister call music_app getSongs '()'
```

5. Get a specific playlist from the storage
```
dfx canister call music_app getPlaylist '("<playlist-id>")'
```

6. Get all playlists from the storage
```
dfx canister call music_app getPlaylists '()'
```

7. Update the playlist's name or description (or both)
```
dfx canister call music_app updatePlaylist '("<playlist-id>", record { "name"= "A new name"; "description"= "A new description" })'
```

8. Add one or more songs into a playlist
```
dfx canister call music_app addSongsToPlaylist '("<playlist-id>", vec { "<song1-id>"; "<song2-id>" })'
```

9. Delete a personal playlist
```
dfx canister call music_app deletePlaylist '("<playlist-id>")'
```

10. Delete a specific song from a playlist
```
dfx canister call music_app deleteSongFromPlaylist '("<playlist-id>", "<song-id>")'
```
