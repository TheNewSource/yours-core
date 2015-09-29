/* global it,describe */
'use strict'
let should = require('should')
let q = require('q')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let BIP32 = require('fullnode/lib/bip32')
let Hash = require('fullnode/lib/hash')
let Address = require('fullnode/lib/address')
let Keypair = require('fullnode/lib/keypair')
let ECDSA = require('fullnode/lib/ecdsa')

let AsyncCrypto = require('../../lib/asynccrypto')
let workerpool = require('workerpool')

describe('AsyncCrypto', function () {
  let databuf = new Buffer(50)
  databuf.fill(0)

  describe('AsyncCrypto', function () {
    it('should exist', function () {
      should.exist(AsyncCrypto)
      should.exist(AsyncCrypto.sha256)
      should.exist(AsyncCrypto.pubkeyFromPrivkey)
      should.exist(AsyncCrypto.addressFromPubkey)
      should.exist(AsyncCrypto.sign)
      let asyncCrypto = new AsyncCrypto()
      should.exist(asyncCrypto)
      should.exist(asyncCrypto.sha256)
      should.exist(asyncCrypto.pubkeyFromPrivkey)
      should.exist(asyncCrypto.addressFromPubkey)
      should.exist(asyncCrypto.sign)
    })

    it('should share the same default worker pool', function () {
      let asyncCrypto = new AsyncCrypto()
      let asyncCrypto2 = new AsyncCrypto()
      asyncCrypto2.pool.should.equal(asyncCrypto.pool)

      let pool
      if (!process.browser) {
        pool = workerpool.pool(__dirname + '/worker.js')
      } else {
        pool = workerpool.pool(process.env.DATT_JS_BASE_URL + process.env.DATT_CORE_JS_WORKER_FILE)
      }
      let asyncCrypto3 = new AsyncCrypto(pool)
      asyncCrypto3.pool.should.not.equal(asyncCrypto.pool)
      asyncCrypto3.pool.should.equal(pool)
    })
  })

  describe('@sha256', function () {
    it('should compute the same as fullnode', function () {
      return AsyncCrypto.sha256(databuf).then(function (buf) {
        buf.compare(Hash.sha256(databuf)).should.equal(0)
      })
    })
  })

  describe('@pubkeyFromPrivkey', function () {
    it('should compute the same as fullnode', function () {
      let privkey = Privkey().fromRandom()
      return AsyncCrypto.pubkeyFromPrivkey(privkey).then(function (pubkey) {
        pubkey.toString().should.equal(Pubkey().fromPrivkey(privkey).toString())
      })
    })
  })

  describe('@addressFromPubkey', function () {
    it('should compute the same as fullnode', function () {
      let privkey = Privkey().fromRandom()
      let pubkey = Pubkey().fromPrivkey(privkey)
      return AsyncCrypto.addressFromPubkey(pubkey).then(function (address) {
        address.toString().should.equal(Address().fromPubkey(pubkey).toString())
      })
    })
  })

  describe('@xkeysFromEntropy', function () {
    it('should derive new mnemonic, xprv, xpub', function () {
      let seedbuf = new Buffer(128 / 8)
      seedbuf.fill(0)
      return AsyncCrypto.xkeysFromEntropy(seedbuf).then(function (obj) {
        obj.mnemonic.should.equal('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')
        obj.xprv.toString().should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu')
        obj.xpub.toString().should.equal('xpub661MyMwAqRbcFkPHucMnrGNzDwb6teAX1RbKQmqtEF8kK3Z7LZ59qafCjB9eCRLiTVG3uxBxgKvRgbubRhqSKXnGGb1aoaqLrpMBDrVxga8')
      })
    })
  })

  describe('@deriveXkeysFromXprv', function () {
    it('should derive new xprv, xpub, address', function () {
      let seedbuf = new Buffer(128 / 8)
      seedbuf.fill(0)
      let xprv = BIP32().fromSeed(seedbuf)
      let path = "m/44'/0'/0'/0/0"
      return AsyncCrypto.deriveXkeysFromXprv(xprv, path).then(function (obj) {
        obj.xprv.toString().should.equal('xprvA4EMaq49eKGKGK2k3kAsiqTowWrNuidQTx5DaYm669TjJUtsEARurRTwXiP1PXsNkxL4pLijwktqb9gSWHccdm92nKDKznNUCSKwvktQLp2')
        obj.xpub.toString().should.equal('xpub6HDhzLb3UgpcUo7D9mht5yQYVYgsKBMFqAzpNwAheUziBHE1mhkAQDnRNyTArZsiyczWpmchy1H6nEzCeLpa7Xm5BGxpbHRP2dKKUR3puTv')
        obj.address.toString().should.equal('1CwgwxqUVapWbgk6ssLruv9eHxHe6LvCe6')
      })
    })
  })

  describe('ECDSA', function () {
    describe('@sign', function () {
      it('should compute the same as bitcore', function () {
        let privkey = Privkey().fromRandom()
        let hashbuf = Hash.sha256(databuf)
        return AsyncCrypto.sign(hashbuf, privkey, 'big').then(function (sig) {
          let keypair = Keypair().fromPrivkey(privkey)
          sig.toString().should.equal(ECDSA.sign(hashbuf, keypair, 'big').toString())
        })
      })
    })

    describe('@verifySignature', function () {
      it('should return true for a valid signature', function () {
        let hashbuf = Hash.sha256(databuf)
        let privkey = Privkey().fromRandom()
        let pubkey = Pubkey().fromPrivkey(privkey)
        return AsyncCrypto.sign(hashbuf, privkey, 'big').then(function (sig) {
          return AsyncCrypto.verifySignature(hashbuf, sig, pubkey)
        }).then(function (verified) {
          should.exist(verified)
          verified.should.eql(true)
        }).catch(function (err) {
          should.fail('Should not throw an error: ' + err + '\n\n ' + err.stack)
        })
      })

      it('should return false for an invalid signature', function () {
        let hashbuf = Hash.sha256(databuf)
        let privkey = Privkey().fromRandom()

        let otherPrivkey = Privkey().fromRandom()
        let otherPubkey = Pubkey().fromPrivkey(otherPrivkey)

        return AsyncCrypto.sign(hashbuf, privkey, 'big').then(function (sig) {
          return AsyncCrypto.verifySignature(hashbuf, sig, otherPubkey)
        }).then(function (verified) {
          should.exist(verified)
          verified.should.eql(false)
        }).catch(function (err) {
          should.fail('Should not throw an error: ' + err + '\n\n ' + err.stack)
        })
      })

      it('should reject the promise if any arguments are missing, null, or undefined', function () {
        let hashbuf = Hash.sha256(databuf)
        let privkey = Privkey().fromRandom()
        let pubkey = Pubkey().fromPrivkey(privkey)

        return AsyncCrypto.sign(hashbuf, privkey, 'big').then(function (sig) {
          return q.allSettled([
            AsyncCrypto.verifySignature(null, sig, pubkey),
            AsyncCrypto.verifySignature(undefined, sig, pubkey),
            AsyncCrypto.verifySignature(hashbuf, null, sig),
            AsyncCrypto.verifySignature(hashbuf, undefined, sig),
            AsyncCrypto.verifySignature(hashbuf, sig, null),
            AsyncCrypto.verifySignature(hashbuf, sig, undefined)
          ])
        }).spread(function (nullHash, undefinedHash, nullSig, undefinedSig, nullPubKey, undefinedPubKey) {
          nullHash.state.should.eql('rejected')
          undefinedHash.state.should.eql('rejected')
          nullSig.state.should.eql('rejected')
          undefinedSig.state.should.eql('rejected')
          nullPubKey.state.should.eql('rejected')
          undefinedPubKey.state.should.eql('rejected')
        })
      })
    })
  })
})