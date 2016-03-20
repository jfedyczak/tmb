"use strict"

const CMD_DF = "/bin/df ."
const CMD_RMDIR = "rm -rf"
const FREE_SPACE_THRESHOLD = 20

const fs = require('fs')
const child_process = require('child_process')
const path = require('path')

const freeSpace = (callback) => {
	child_process.exec(CMD_DF, {
		cwd: process.cwd(),
		encoding: 'utf8'
	}, (err, so, se) => {
		if (err) callback(err)
		let d = so.split("\n")[1].split(/\s+/).splice(1, 3)
		callback(null, Math.round(100 * d[2] / d[0]))
	})
}

const rmDir = (folder, callback) => {
	child_process.exec(CMD_RMDIR + ` ${folder}`, {
		cwd: process.cwd(),
		encoding: 'utf8'
	}, (err, so, se) => {
		callback(err)
	})
}

const daysList = (callback) => {
	fs.readdir('.', (e, list) => {
		list = list.filter((d) => {
			return /^\d{4}-\d{2}-\d{2}$/.test(d)
		})
		list.sort()
		callback(null, list)
	})
}

const today = () => {
	let ts = new Date()
	let d = ts.getDate() + ''
	if (d.length < 2) d = '0' + d
	let m = ts.getMonth() + 1 + ''
	if (m.length < 2) m = '0' + m
	let y = ts.getFullYear() + ''
	return `${y}-${m}-${d}`
}

const taskSeries = (tasks, callback) => {
	let nextTask = (err) => {
		if (err) {
			console.log(err)
			return
		}
		if (tasks.length == 0) return
		let task = tasks.shift()
		task(nextTask)
	}
	nextTask(null)
}

const taskRsync = (callback) => {
	let params = process.argv.slice(2)
	daysList((e, list) => {
		let rsync_cmd = params.shift()
		let sourceFolder = today()
		let targetFolder = sourceFolder
		while (list.length > 0 && list[list.length - 1] <= targetFolder) {
			sourceFolder = list.pop()
		}
		sourceFolder = path.resolve(sourceFolder) + '/'
		targetFolder = path.resolve(targetFolder) + '/'
		params.unshift(`--link-dest=${sourceFolder}`)
		params.push(targetFolder)
		console.log(" -- starting rsync:");
		params.forEach((l) => {
			console.log(`    ${l}`)
		})
		let rsyncP = child_process.spawn(rsync_cmd, params, {
			cwd: process.cwd(),
			shell: true,
			stdio: ['ignore', 'ignore', 'pipe']
		}).on('close', (code) => {
			console.log(`code: ${code}`)
			callback(null)
		})
		
		rsyncP.stderr.on('data', (data) => {
			console.log(` -- error: ${data}`)
		})
	})
}

const taskCreateFolders = (callback) => {
	let t = today()
	console.log(` -- checking if folder ${t} exists`)
	fs.exists(t, (exst) => {
		if (exst) return callback(null)
		console.log(` -- creating folder ${t}`)
		fs.mkdir(t, callback)
	})
}

const taskFreeDiskSpace = (callback) => {
	freeSpace((e, space) => {
		if (e) return callback(e)
		console.log(` -- free space left: ${space}%`)
		if (space >= FREE_SPACE_THRESHOLD) return callback(null)
		daysList((e, list) => {
			if (e) return callback(e)
			if (list.length < 2) {
				console.log(" -- only one folder left - skipping removal");
				return callback(null);
			}
			console.log(` -- removing olderst folder ${list[0]}...`);
			rmDir(list[0], (e) => {
				if (e) return callback(e)
				taskFreeDiskSpace(callback)
			})
		})
	})
}

taskSeries([
	taskFreeDiskSpace,
	taskCreateFolders,
	taskRsync
], (e) => {
	if (e) console.log(e);
});

console.log(process.argv)
